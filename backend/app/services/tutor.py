"""AI tutor: retrieves the right lesson passages, answers in simple language, then routes the
answer through the translation engine so the child hears it in their mother tongue.

Uses Claude (Anthropic API) when ANTHROPIC_API_KEY is set; otherwise falls back to
retrieval-only answers that work fully offline."""
from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..languages import LANGUAGES
from ..models import Lesson, Word
from .text import SimilarityIndex, normalize
from .translation import translate

log = logging.getLogger("tutor")

GREETINGS = {"hi", "hello", "hey", "namaste", "johar", "juar", "नमस्ते", "जोहार", "हेलो"}
_index_cache: dict = {}


def _passages(db: Session) -> tuple[list[dict], SimilarityIndex]:
    lessons = db.scalars(select(Lesson)).all()
    key = tuple((l.id, len(l.sections)) for l in lessons)
    if _index_cache.get("key") == key:
        return _index_cache["p"], _index_cache["i"]
    passages = []
    for l in lessons:
        for s in l.sections:
            passages.append({"lesson_id": l.id, "lesson": l.title_en, "en": s["en"], "hi": s["hi"], "subject": l.subject})
        for v in l.vocab:
            passages.append({"lesson_id": l.id, "lesson": l.title_en, "en": f"{v['en']} means {v['hi']}", "hi": f"{v['en']} का मतलब {v['hi']} है", "subject": l.subject})
    index = SimilarityIndex([f"{p['en']} {p['hi']}" for p in passages])
    _index_cache.update(key=key, p=passages, i=index)
    return passages, index


def retrieve(db: Session, question: str, k: int = 3) -> list[dict]:
    passages, index = _passages(db)
    hits = [(passages[i], s) for i, s in index.query(question, k=k) if s > 0.12]
    return [{**p, "score": round(s, 2)} for p, s in hits]


def _word_lookup(db: Session, question: str, lang: str) -> str | None:
    """'tree in Santali' / 'what is water' -> vocabulary from the community dictionary."""
    q = normalize(question)
    target = next((c for c, meta in LANGUAGES.items() if meta["tribal"] and (meta["name"].lower() in q or meta["native"] in question)), None)
    target = target or (lang if LANGUAGES.get(lang, {}).get("tribal") else None)
    if not target:
        return None
    words = db.scalars(select(Word).where(Word.language == target, Word.status != "rejected")).all()
    for w in words:
        if normalize(w.meaning_en) in q.split() or (w.meaning_hi and w.meaning_hi in question):
            return f"{w.meaning_en} = {w.term} ({LANGUAGES[target]['name']})"
    return None


def _llm(question: str, ctx: list[dict], history: list[dict], grade: int, answer_lang: str) -> str | None:
    if not settings.ANTHROPIC_API_KEY:
        return None
    context = "\n".join(f"- ({c['lesson']}) {c[answer_lang if answer_lang in ('en', 'hi') else 'en']}" for c in ctx) or "(no matching lesson text)"
    system = (
        "You are Shiksha Vani, a warm, patient tutor for a Grade {g} child in a rural Indian school. "
        "Answer in {lang} using very short, simple sentences (max 4). Use a familiar village example when it helps. "
        "Base your answer on the lesson notes when relevant; if the notes do not cover it, answer simply and say you are not fully sure. "
        "Never use difficult words. End with one tiny question to check understanding.\n\nLesson notes:\n{ctx}"
    ).format(g=grade, lang=LANGUAGES[answer_lang]["name"], ctx=context)
    messages = [{"role": m["role"], "content": m["text"]} for m in history[-6:] if m.get("role") in ("user", "assistant")]
    messages.append({"role": "user", "content": question})
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": settings.ANTHROPIC_MODEL, "max_tokens": 400, "system": system, "messages": messages},
            timeout=25,
        )
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", [])).strip() or None
    except Exception as e:
        log.warning("LLM tutor failed: %s", e)
        return None


def answer(db: Session, question: str, lang: str, grade: int, history: list[dict] | None = None) -> dict:
    history = history or []
    q = question.strip()
    # 1) understand the question: bring tribal-language input to Hindi when MT exists
    q_for_search = q
    if LANGUAGES.get(lang, {}).get("tribal"):
        t = translate(db, q, lang, "hi", allow_similar=False)
        if t.status in ("verified", "draft"):
            q_for_search = t.text

    if normalize(q) in {normalize(g) for g in GREETINGS}:
        base = {"hi": "जोहार! मैं शिक्षा वाणी हूँ। आज क्या सीखना है?", "en": "Johar! I am Shiksha Vani. What shall we learn today?"}
        return _finish(db, base["en" if lang == "en" else "hi"], "en" if lang == "en" else "hi", lang, [], "greeting", "greeting")

    vocab = _word_lookup(db, q_for_search if q_for_search != q else q, lang)
    ctx = retrieve(db, q_for_search)

    # 2) think in Hindi/English (or the child's language if it is a major language)
    think_lang = lang if lang in ("hi", "en", "bn", "or") else "hi"
    text = _llm(q_for_search, ctx, history, grade, think_lang)
    engine, kind = ("claude", "llm") if text else ("retrieval", "lesson")
    if not text:
        if vocab:
            text, think_lang, kind = vocab, "en", "word"
        elif ctx:
            # Exact lesson sentence -> exact hit in translation memory, so tribal-language output is reliable.
            think_lang = "en" if lang == "en" else "hi"
            text = ctx[0][think_lang]
        else:
            text, kind, engine = "", "none", "none"
            think_lang = "en" if lang == "en" else "hi"
    return _finish(db, text, think_lang, lang, ctx, engine, kind)


def _finish(db: Session, text: str, text_lang: str, lang: str, ctx: list[dict], engine: str, kind: str) -> dict:
    translated = False
    shown_lang = text_lang
    final = text
    if text and lang != text_lang:
        t = translate(db, text, text_lang, lang, allow_similar=False)
        if t.status in ("verified", "draft", "approx"):
            final, shown_lang, translated = t.text, lang, True
    return {
        "reply": final,
        "kind": kind,
        "reply_lang": shown_lang,
        "translated": translated,
        "engine": engine,
        "sources": [{"lesson_id": c["lesson_id"], "lesson": c["lesson"], "score": c["score"]} for c in ctx[:2]],
    }
