"""Languages, translation, lessons, community dictionary, AI tutor, speech."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..languages import LANGUAGES
from ..models import Lesson, User, Word
from ..security import current_user, require_role
from ..services import speech, translation, tutor

router = APIRouter(prefix="/api", tags=["learn"])


@router.get("/languages")
def languages():
    return {"languages": [{"code": c, **{k: v for k, v in m.items() if k != "public_mt"}} for c, m in LANGUAGES.items()],
            "capabilities": translation.capabilities()}


class TranslateIn(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    src: str
    tgt: str


@router.post("/translate")
def translate_text(body: TranslateIn, db: Session = Depends(get_db)):
    """Public on purpose: powers the try-it box on the landing page."""
    if body.src not in LANGUAGES or body.tgt not in LANGUAGES:
        raise HTTPException(400, "Unsupported language.")
    return translation.translate(db, body.text, body.src, body.tgt, min_similarity=0.7).dict()


@router.get("/showcase")
def showcase(db: Session = Depends(get_db)):
    """Public: vocabulary shown on the landing page. Only words that exist in >=3 tribal languages."""
    rows = db.scalars(select(Word).where(Word.status != "rejected")).all()
    grouped: dict[str, dict] = {}
    for w in rows:
        g = grouped.setdefault(w.meaning_en, {"en": w.meaning_en, "hi": w.meaning_hi, "terms": {}, "verified": True})
        g["terms"].setdefault(w.language, w.term)
        g["verified"] = g["verified"] and w.status == "verified"
    order = ["tree", "water", "sun", "moon", "mother", "bird", "house", "village", "fish", "dog"]
    picks = [grouped[k] for k in order if k in grouped and len(grouped[k]["terms"]) >= 3]
    return picks[:8]


# ------------------------------------------------------------------ lessons
def _tr(db, text, lang, src="hi"):
    """Translate authored lesson text into `lang`; returns the display dict."""
    if lang == "hi" or lang == "en":
        return {"text": text, "status": "verified", "method": "source"}
    r = translation.translate(db, text, src, lang, allow_similar=False)
    return {"text": r.text, "status": r.status, "method": r.method}


def localized_lesson(db: Session, lesson: Lesson, lang: str, full: bool = True) -> dict:
    def pick(en, hi):
        """Return (source_text_for_pivot, display dict) for a string authored in en+hi."""
        if lang == "en":
            return {"text": en, "status": "verified", "method": "source"}
        if lang == "hi":
            return {"text": hi, "status": "verified", "method": "source"}
        return _tr(db, hi, lang, "hi")

    title = pick(lesson.title_en, lesson.title_hi)
    out = {"id": lesson.id, "slug": lesson.slug, "subject": lesson.subject, "grade": lesson.grade, "emoji": lesson.emoji,
           "minutes": lesson.minutes, "lang": lang, "title": title["text"], "title_status": title["status"], "title_hi": lesson.title_hi, "title_en": lesson.title_en}
    if not full:
        return out
    sections, vocab, quiz, statuses = [], [], [], [title["status"]]
    for s in lesson.sections:
        d = pick(s["en"], s["hi"])
        statuses.append(d["status"])
        sections.append({"id": s["id"], "text": d["text"], "status": d["status"], "en": s["en"], "hi": s["hi"]})
    for v in lesson.vocab:
        d = pick(v["en"], v["hi"])
        statuses.append(d["status"])
        vocab.append({"en": v["en"], "hi": v["hi"], "emoji": v.get("emoji"), "term": d["text"], "status": d["status"]})
    for q in lesson.quiz:
        qd = pick(q["q"]["en"], q["q"]["hi"])
        opts = []
        for o in q["options"]:
            od = pick(o["en"], o["hi"])
            opts.append({"text": od["text"], "status": od["status"], "en": o["en"], "hi": o["hi"]})
        statuses += [qd["status"]] + [o["status"] for o in opts]
        quiz.append({"id": q["id"], "q": qd["text"], "status": qd["status"], "options": opts, "answer": q["answer"], "q_en": q["q"]["en"], "q_hi": q["q"]["hi"]})
    ok = sum(1 for s in statuses if s in ("verified", "draft", "approx"))
    out.update(sections=sections, vocab=vocab, quiz=quiz, coverage=round(ok / len(statuses), 2),
               verified=round(sum(1 for s in statuses if s == "verified") / len(statuses), 2))
    return out


@router.get("/lessons")
def list_lessons(user: User = Depends(current_user), db: Session = Depends(get_db)):
    lang = user.language
    return [localized_lesson(db, l, lang, full=False) for l in db.scalars(select(Lesson).order_by(Lesson.grade, Lesson.id)).all()]


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: int, lang: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found.")
    lang = lang if lang in LANGUAGES else user.language
    return localized_lesson(db, lesson, lang)


@router.get("/practice/sentences")
def practice_sentences(lang: str = "hi", user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Sentences for read-aloud practice. Only languages the team authored (hi/en) - so the model answer is always correct."""
    lang = lang if lang in ("hi", "en") else "hi"
    out = []
    for l in db.scalars(select(Lesson).order_by(Lesson.grade, Lesson.id)).all():
        for s in l.sections:
            out.append({"lesson_id": l.id, "emoji": l.emoji, "title": l.title_en if lang == "en" else l.title_hi, "grade": l.grade, "text": s[lang], "words": len(s[lang].split())})
    return out


# ------------------------------------------------------------------ dictionary
class WordIn(BaseModel):
    language: str
    term: str = Field(min_length=1, max_length=120)
    meaning_en: str = Field(min_length=1, max_length=160)
    meaning_hi: str | None = Field(default=None, max_length=160)
    audio: str | None = Field(default=None, max_length=400_000)


def word_out(w: Word, names: dict) -> dict:
    return {"id": w.id, "language": w.language, "term": w.term, "meaning_en": w.meaning_en, "meaning_hi": w.meaning_hi,
            "audio": w.audio, "status": w.status, "by": names.get(w.contributor_id)}


@router.get("/words")
def list_words(lang: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Word).order_by(Word.meaning_en)
    if lang:
        q = q.where(Word.language == lang)
    rows = db.scalars(q).all()
    ids = {w.contributor_id for w in rows if w.contributor_id}
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(ids))).all()} if ids else {}
    return [word_out(w, names) for w in rows]


@router.post("/words")
def add_word(body: WordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not LANGUAGES.get(body.language, {}).get("tribal"):
        raise HTTPException(400, "Words can be added for Santali, Mundari, Ho and Kurukh.")
    if body.audio and not body.audio.startswith("data:audio/"):
        raise HTTPException(400, "Audio must be an audio clip.")
    w = Word(language=body.language, term=body.term.strip(), meaning_en=body.meaning_en.strip().lower(),
             meaning_hi=(body.meaning_hi or "").strip() or None, audio=body.audio,
             status="verified" if user.role == "teacher" else "draft", contributor_id=user.id)
    db.add(w)
    db.commit()
    if w.status == "verified":
        translation.add_verified(db, "en", w.language, w.meaning_en, w.term, user.id)
    return word_out(w, {user.id: user.name})


@router.post("/words/{word_id}/verify")
def verify_word(word_id: int, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    w = db.get(Word, word_id)
    if not w:
        raise HTTPException(404, "Word not found.")
    w.status = "verified"
    db.commit()
    translation.add_verified(db, "en", w.language, w.meaning_en, w.term, user.id)
    if w.meaning_hi:
        translation.add_verified(db, "hi", w.language, w.meaning_hi, w.term, user.id)
    translation.add_verified(db, w.language, "en", w.term, w.meaning_en, user.id)
    return {"ok": True}


# ------------------------------------------------------------------ tutor + speech
class TutorIn(BaseModel):
    message: str = Field(min_length=1, max_length=400)
    history: list[dict] = []


@router.post("/tutor")
def ask_tutor(body: TutorIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return tutor.answer(db, body.message, user.language, user.grade or 3, body.history)


class ScoreIn(BaseModel):
    target: str
    spoken: str
    seconds: float | None = None


@router.post("/speech/score")
def score(body: ScoreIn, user: User = Depends(current_user)):
    return speech.score_reading(body.target, body.spoken, body.seconds)


class TranscribeIn(BaseModel):
    audio_b64: str = Field(max_length=6_000_000)
    lang: str


@router.post("/speech/transcribe")
def transcribe(body: TranscribeIn, user: User = Depends(current_user)):
    try:
        return speech.transcribe(body.audio_b64, body.lang)
    except RuntimeError as e:
        raise HTTPException(501, "Speech recognition for this language is not set up on the server yet. Add Bhashini keys to enable it.") from e
    except Exception as e:
        raise HTTPException(502, "The speech service did not respond. Please try again.") from e
