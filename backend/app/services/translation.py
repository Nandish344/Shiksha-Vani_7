"""Translation engine.

Order of attack (fast + trustworthy first):
  1. Translation memory  - exact match; teacher-verified entries win
  2. Bhashini            - government MT for Indian & tribal languages (if credentials set)
  3. Public fallback     - MyMemory for hi/en/bn/or demos (opt-in, never for tribal languages)
  4. Semantic match      - closest sentence already in the memory (works fully offline)
  5. Passthrough         - return the source text, flagged as 'missing' so the UI can say so

Every machine translation is stored as a *draft* and enters the teacher review queue.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, asdict

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..languages import LANGUAGES
from ..models import Translation
from .bhashini import BhashiniError, bhashini
from .text import SimilarityIndex, text_hash

log = logging.getLogger("translation")

SIMILARITY_THRESHOLD = 0.62

_tm_version = 0
_index_cache: dict[tuple[str, str], tuple[int, list[Translation], SimilarityIndex]] = {}


def bump_tm() -> None:
    global _tm_version
    _tm_version += 1


@dataclass
class Result:
    text: str
    method: str  # memory | bhashini | public | similar | same | none
    status: str  # verified | draft | approx | missing | same
    confidence: float = 1.0
    matched: str | None = None

    def dict(self) -> dict:
        return asdict(self)


def _store(db: Session, src: str, tgt: str, text: str, out: str, status: str, source: str) -> None:
    h = text_hash(text)
    row = db.scalar(select(Translation).where(Translation.src_lang == src, Translation.tgt_lang == tgt, Translation.src_hash == h))
    if row:
        return
    db.add(Translation(src_lang=src, tgt_lang=tgt, src_hash=h, src_text=text, tgt_text=out, status=status, source=source))
    try:
        db.commit()
        bump_tm()
    except Exception:  # race with another worker inserting the same row
        db.rollback()


def _exact(db: Session, text: str, src: str, tgt: str) -> Translation | None:
    rows = db.scalars(
        select(Translation).where(
            Translation.src_lang == src,
            Translation.tgt_lang == tgt,
            Translation.src_hash == text_hash(text),
            Translation.status != "rejected",
        )
    ).all()
    if not rows:
        return None
    rows.sort(key=lambda r: r.status != "verified")
    return rows[0]


def _digits(t: str) -> str:
    return "".join(ch for ch in t if ch.isdigit())


def _similar(db: Session, text: str, src: str, tgt: str, min_score: float) -> Result | None:
    key = (src, tgt)
    cached = _index_cache.get(key)
    if not cached or cached[0] != _tm_version:
        rows = db.scalars(select(Translation).where(Translation.src_lang == src, Translation.tgt_lang == tgt, Translation.status != "rejected")).all()
        if not rows:
            return None
        cached = (_tm_version, rows, SimilarityIndex([r.src_text for r in rows]))
        _index_cache[key] = cached
    _, rows, index = cached
    hits = index.query(text, k=1)
    if hits and hits[0][1] >= min_score:
        row = rows[hits[0][0]]
        if _digits(row.src_text) != _digits(text):  # never swap numbers between sentences
            return None
        return Result(row.tgt_text, "similar", "approx", round(hits[0][1], 2), row.src_text)
    return None


def _public(text: str, src: str, tgt: str) -> str | None:
    if not (settings.ENABLE_PUBLIC_FALLBACK and LANGUAGES[src]["public_mt"] and LANGUAGES[tgt]["public_mt"]):
        return None
    try:
        r = httpx.get("https://api.mymemory.translated.net/get", params={"q": text, "langpair": f"{src}|{tgt}"}, timeout=8)
        data = r.json()
        out = (data.get("responseData") or {}).get("translatedText")
        if r.status_code == 200 and out and float((data["responseData"].get("match") or 0)) >= 0.4:
            return out.strip()
    except Exception as e:  # network / rate limit
        log.info("public MT failed: %s", e)
    return None


def translate(db: Session, text: str, src: str, tgt: str, allow_similar: bool = True, min_similarity: float = SIMILARITY_THRESHOLD) -> Result:
    """allow_similar=False for dynamic text (reports, chat) where a 'nearby' sentence would be wrong."""
    text = (text or "").strip()
    if not text or src == tgt:
        return Result(text, "same", "same")
    if src not in LANGUAGES or tgt not in LANGUAGES:
        return Result(text, "none", "missing", 0)

    row = _exact(db, text, src, tgt)
    if row:
        return Result(row.tgt_text, "memory", row.status)

    if bhashini.enabled:
        try:
            out = bhashini.translate(text, src, tgt)
            if out:
                _store(db, src, tgt, text, out, "draft", "bhashini")
                return Result(out, "bhashini", "draft", 0.9)
        except (BhashiniError, httpx.HTTPError, KeyError) as e:
            log.warning("Bhashini failed (%s -> %s): %s", src, tgt, e)

    out = _public(text, src, tgt)
    if out:
        _store(db, src, tgt, text, out, "draft", "public")
        return Result(out, "public", "draft", 0.7)

    if allow_similar:
        similar = _similar(db, text, src, tgt, min_similarity)
        if similar:
            return similar

    return Result(text, "none", "missing", 0)


def add_verified(db: Session, src: str, tgt: str, text: str, out: str, reviewer_id: int | None, source: str = "teacher") -> Translation:
    """Teacher-authored / approved translation. Replaces any existing row for this sentence."""
    h = text_hash(text)
    row = db.scalar(select(Translation).where(Translation.src_lang == src, Translation.tgt_lang == tgt, Translation.src_hash == h))
    if row:
        row.tgt_text, row.status, row.source, row.reviewed_by = out, "verified", source, reviewer_id
    else:
        row = Translation(src_lang=src, tgt_lang=tgt, src_hash=h, src_text=text, tgt_text=out, status="verified", source=source, reviewed_by=reviewer_id)
        db.add(row)
    db.commit()
    bump_tm()
    return row


def capabilities() -> dict:
    return {
        "bhashini": bhashini.enabled,
        "public_fallback": settings.ENABLE_PUBLIC_FALLBACK,
        "asr": bhashini.enabled or bool(settings.WHISPER_API_URL),
        "llm_tutor": bool(settings.ANTHROPIC_API_KEY),
    }
