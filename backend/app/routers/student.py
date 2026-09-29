"""Student home feed, offline sync, class recaps."""
from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, ClassSession, Confusion, Lesson, User, Word, iso, utcnow
from ..security import require_role
from ..services import analytics
from ..services.translation import translate
from .learn import localized_lesson

router = APIRouter(prefix="/api", tags=["student"])


def _live(db: Session):
    rows = db.scalars(select(ClassSession).where(ClassSession.is_live == True).order_by(ClassSession.started_at.desc())).all()  # noqa: E712
    teachers = {u.id: u for u in db.scalars(select(User).where(User.id.in_({r.teacher_id for r in rows}))).all()} if rows else {}
    return [{"id": r.id, "code": r.code, "title": r.title, "source_lang": r.source_lang, "started_at": iso(r.started_at),
             "teacher": teachers[r.teacher_id].name if r.teacher_id in teachers else None} for r in rows]


@router.get("/student/home")
def home(user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    lessons = db.scalars(select(Lesson)).all()
    lmap = {l.id: l for l in lessons}
    att = analytics.load_attempts(db, [user.id]).get(user.id, [])
    stats = analytics.student_stats(user, att, lmap)
    recs = analytics.recommendations(user, att, lessons, user.language)
    for r in recs:
        r["lesson"] = localized_lesson(db, lmap[r["lesson_id"]], user.language, full=False)
    today = utcnow().date()
    word = None
    words = db.scalars(select(Word).where(Word.language == user.language, Word.status != "rejected").order_by(Word.id)).all()
    if words:
        word = words[today.toordinal() % len(words)]
        word = {"term": word.term, "meaning_en": word.meaning_en, "meaning_hi": word.meaning_hi, "status": word.status}
    week_days = {a.created_at.date() for a in att}
    return {
        "stats": stats,
        "recommendations": recs,
        "live": _live(db),
        "word_of_day": word,
        "week": [{"date": (today - timedelta(days=i)).isoformat(), "active": (today - timedelta(days=i)) in week_days} for i in range(6, -1, -1)],
    }


class SyncEvent(BaseModel):
    id: str
    type: str  # attempt | confusion
    payload: dict
    ts: str | None = None


class SyncIn(BaseModel):
    events: list[SyncEvent]


@router.post("/sync")
def sync(body: SyncIn, user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    """Idempotent batch upload for the offline queue: replaying an event id is a no-op."""
    accepted, duplicates = [], 0
    for ev in body.events[:200]:
        model = Attempt if ev.type == "attempt" else Confusion if ev.type == "confusion" else None
        if not model:
            continue
        if db.scalar(select(model.id).where(model.client_id == ev.id)):
            duplicates += 1
            accepted.append(ev.id)
            continue
        p = ev.payload
        when = utcnow()
        if ev.ts:
            try:
                from datetime import datetime, timezone
                when = datetime.fromisoformat(ev.ts.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
            except ValueError:
                pass
        if model is Attempt:
            kind = p.get("kind") if p.get("kind") in ("lesson", "quiz", "practice") else "lesson"
            db.add(Attempt(client_id=ev.id, student_id=user.id, lesson_id=p.get("lesson_id"), kind=kind,
                           score=max(0, min(100, float(p.get("score", 0)))), seconds=int(p.get("seconds", 0)),
                           language=user.language, detail=p.get("detail"), created_at=when))
        else:
            db.add(Confusion(client_id=ev.id, student_id=user.id, lesson_id=p.get("lesson_id"), session_id=p.get("session_id"), note=(p.get("note") or "")[:200] or None, created_at=when))
        accepted.append(ev.id)
    db.commit()
    return {"accepted": accepted, "duplicates": duplicates}


@router.get("/student/recaps")
def recaps(user: User = Depends(require_role("student", "parent")), db: Session = Depends(get_db)):
    """Notes from recent live classes, in the child's mother tongue."""
    sessions = db.scalars(select(ClassSession).where(ClassSession.is_live == False).order_by(ClassSession.started_at.desc()).limit(3)).all()  # noqa: E712
    lang = user.language
    out = []
    for s in sessions:
        lines = []
        for u in s.utterances:
            if lang == u.lang:
                lines.append({"text": u.text, "status": "source", "src": u.text})
            else:
                r = translate(db, u.text, u.lang, lang, allow_similar=False)
                lines.append({"text": r.text, "status": r.status, "src": u.text})
        out.append({"id": s.id, "title": s.title, "date": iso(s.started_at), "lang": lang, "lines": lines})
    return out
