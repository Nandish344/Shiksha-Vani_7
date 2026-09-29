"""Teacher dashboard, student detail, translation review queue, parent messages, CSV export."""
import csv
import io
from datetime import timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..languages import LANGUAGES
from ..models import Attempt, Confusion, Lesson, Message, Translation, User, iso, utcnow
from ..security import require_role
from ..services import analytics, translation
from ..services.reports import build_report
from .learn import localized_lesson

router = APIRouter(prefix="/api/teacher", tags=["teacher"])
teacher_only = require_role("teacher")


@router.get("/overview")
def overview(user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    data = analytics.class_overview(db, user.id)
    data["students"] = sorted(data["students"], key=lambda s: (s["comprehension"] is None, s["comprehension"] or 0))
    pending = db.scalar(select(func.count()).select_from(Translation).where(Translation.status == "draft", Translation.tgt_lang.in_(["sat", "unr", "hoc", "kru"])))
    data["pending_reviews"] = pending
    recent = db.scalars(select(Confusion).where(Confusion.created_at >= utcnow() - timedelta(days=7))).all()
    names = {u.id: u.name for u in db.scalars(select(User).where(User.role == "student")).all()}
    lessons = {l.id: l.title_en for l in db.scalars(select(Lesson)).all()}
    by_lesson: dict[str, int] = defaultdict(int)
    for c in recent:
        if c.lesson_id in lessons:
            by_lesson[lessons[c.lesson_id]] += 1
    data["confusion_by_lesson"] = sorted(({"lesson": k, "count": v} for k, v in by_lesson.items()), key=lambda x: -x["count"])
    data["recent_confusions"] = [{"student": names.get(c.student_id), "lesson": lessons.get(c.lesson_id), "at": iso(c.created_at)} for c in sorted(recent, key=lambda c: c.created_at, reverse=True)[:6]]
    return data


@router.get("/students/{student_id}")
def student_detail(student_id: int, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    s = db.get(User, student_id)
    if not s or s.role != "student":
        raise HTTPException(404, "Student not found.")
    lessons = {l.id: l for l in db.scalars(select(Lesson)).all()}
    att = analytics.load_attempts(db, [s.id]).get(s.id, [])
    stats = analytics.student_stats(s, att, lessons)
    conf = db.scalar(select(func.count()).select_from(Confusion).where(Confusion.student_id == s.id, Confusion.created_at >= utcnow() - timedelta(days=7)))
    now = utcnow()
    daily = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        sc = [a.score for a in att if a.kind == "quiz" and a.created_at.date() == day]
        daily.append({"date": day.isoformat(), "score": round(sum(sc) / len(sc)) if sc else None})
    parent = db.get(User, s.parent_id) if s.parent_id else None
    recent = [{"kind": a.kind, "score": a.score, "lesson": lessons[a.lesson_id].title_en if a.lesson_id in lessons else None,
               "emoji": lessons[a.lesson_id].emoji if a.lesson_id in lessons else None, "at": iso(a.created_at)}
              for a in reversed(att[-40:]) if a.kind != "lesson"][:10]
    return {"stats": stats, "alerts": analytics.student_alerts(stats, conf or 0), "daily": daily, "recent": recent,
            "parent": {"id": parent.id, "name": parent.name, "language": parent.language} if parent else None}


@router.get("/report/{student_id}")
def report(student_id: int, lang: str | None = None, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    s = db.get(User, student_id)
    if not s or s.role != "student":
        raise HTTPException(404, "Student not found.")
    lessons = {l.id: l for l in db.scalars(select(Lesson)).all()}
    stats = analytics.student_stats(s, analytics.load_attempts(db, [s.id]).get(s.id, []), lessons)
    parent = db.get(User, s.parent_id) if s.parent_id else None
    lang = lang if lang in LANGUAGES else (parent.language if parent else s.language)
    rep = build_report(db, s, stats, lang)
    rep["hindi"] = build_report(db, s, stats, "hi")
    rep["teacher"] = user.name
    rep["date"] = utcnow().date().isoformat()
    return rep


@router.get("/export.csv")
def export_csv(user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    data = analytics.class_overview(db)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "grade", "mother_tongue", "village", "comprehension_pct", "reading_pct", "streak_days", "stars", "lessons_done", "days_inactive"])
    for s in data["students"]:
        w.writerow([s["name"], s["grade"], LANGUAGES[s["language"]]["name"], s["village"], s["comprehension"], s["pronunciation"], s["streak"], s["stars"], s["lessons_done"], s["days_inactive"]])
    return Response(buf.getvalue().encode("utf-8-sig"), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=shiksha-vani-class-report.csv"})


@router.get("/phrases")
def phrases(user: User = Depends(teacher_only)):
    """Classroom phrasebook for one-tap live captions."""
    from ..content import PHRASES
    return [{"en": en, "hi": hi} for en, hi in PHRASES]


# ------------------------------------------------------------------ translation review
@router.get("/review")
def review_queue(status: str = "draft", lang: str | None = None, limit: int = 60, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    q = select(Translation).where(Translation.status == status, Translation.src_lang.in_(["hi", "en"]) & Translation.tgt_lang.in_(list(LANGUAGES)))
    if lang:
        q = q.where(Translation.tgt_lang == lang)
    q = q.order_by(Translation.tgt_lang, Translation.src_lang.desc(), Translation.id).limit(min(limit, 200))
    rows = db.scalars(q).all()
    counts = dict(db.execute(select(Translation.status, func.count()).group_by(Translation.status)).all())
    return {"counts": counts, "items": [{"id": r.id, "src_lang": r.src_lang, "tgt_lang": r.tgt_lang, "src": r.src_text, "tgt": r.tgt_text, "source": r.source, "status": r.status} for r in rows]}


class ReviewIn(BaseModel):
    action: str  # approve | reject | edit
    text: str | None = Field(default=None, max_length=600)


@router.post("/review/{tm_id}")
def review(tm_id: int, body: ReviewIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    row = db.get(Translation, tm_id)
    if not row:
        raise HTTPException(404, "Translation not found.")
    if body.action == "approve":
        row.status, row.reviewed_by = "verified", user.id
    elif body.action == "reject":
        row.status, row.reviewed_by = "rejected", user.id
    elif body.action == "edit" and body.text and body.text.strip():
        row.tgt_text, row.status, row.reviewed_by, row.source = body.text.strip(), "verified", user.id, "teacher"
    else:
        raise HTTPException(400, "Unknown action.")
    db.commit()
    translation.bump_tm()
    return {"id": row.id, "status": row.status, "tgt": row.tgt_text}


class AuthorIn(BaseModel):
    src: str
    tgt: str
    text: str = Field(min_length=1, max_length=400)
    translation: str = Field(min_length=1, max_length=600)


@router.post("/translations")
def author_translation(body: AuthorIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    if body.src not in LANGUAGES or body.tgt not in LANGUAGES:
        raise HTTPException(400, "Unsupported language.")
    row = translation.add_verified(db, body.src, body.tgt, body.text.strip(), body.translation.strip(), user.id)
    return {"id": row.id, "status": row.status}


class PrepareIn(BaseModel):
    langs: list[str]


@router.post("/lessons/{lesson_id}/prepare")
def prepare_lesson(lesson_id: int, body: PrepareIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    """Pre-translate a lesson (Bhashini -> drafts) so students never wait, even on slow networks."""
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found.")
    result = {}
    for lang in body.langs:
        if lang in LANGUAGES:
            l = localized_lesson(db, lesson, lang)
            result[lang] = {"coverage": l["coverage"], "verified": l["verified"]}
    return {"lesson_id": lesson_id, "languages": result, "bhashini": translation.capabilities()["bhashini"]}


# ------------------------------------------------------------------ parent messages
class MsgIn(BaseModel):
    student_id: int
    text: str = Field(min_length=1, max_length=500)


@router.get("/messages")
def messages(user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(Message).where((Message.to_id == user.id) | (Message.from_id == user.id)).order_by(Message.created_at.desc()).limit(30)).all()
    ids = {r.from_id for r in rows} | {r.student_id for r in rows if r.student_id}
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(ids))).all()} if ids else {}
    return [{"id": r.id, "from": names.get(r.from_id), "mine": r.from_id == user.id, "student": names.get(r.student_id), "student_id": r.student_id,
             "text": r.translated.get("hi", r.text) if r.translated and r.from_id != user.id else r.text, "original": r.text, "lang": r.lang, "at": iso(r.created_at)} for r in rows]


@router.post("/messages")
def send_message(body: MsgIn, user: User = Depends(teacher_only), db: Session = Depends(get_db)):
    s = db.get(User, body.student_id)
    if not s or not s.parent_id:
        raise HTTPException(400, "This student has no parent account linked yet.")
    parent = db.get(User, s.parent_id)
    r = translation.translate(db, body.text, "hi", parent.language, allow_similar=False)
    shown = r.text if r.status in ("verified", "draft") else body.text
    db.add(Message(from_id=user.id, to_id=parent.id, student_id=s.id, text=body.text, lang="hi", translated={parent.language: shown}))
    db.commit()
    return {"ok": True, "delivered_in": parent.language if r.status in ("verified", "draft") else "hi"}
