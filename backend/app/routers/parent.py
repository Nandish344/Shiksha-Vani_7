from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..languages import LANGUAGES
from ..models import Lesson, Message, User, iso
from ..security import require_role
from ..services import analytics, translation
from ..services.reports import build_report

router = APIRouter(prefix="/api/parent", tags=["parent"])
parent_only = require_role("parent")


def _children(db: Session, parent: User) -> list[User]:
    return db.scalars(select(User).where(User.parent_id == parent.id)).all()


@router.get("/children")
def children(user: User = Depends(parent_only), db: Session = Depends(get_db)):
    kids = _children(db, user)
    lessons = {l.id: l for l in db.scalars(select(Lesson)).all()}
    att = analytics.load_attempts(db, [k.id for k in kids])
    out = []
    for k in kids:
        stats = analytics.student_stats(k, att.get(k.id, []), lessons)
        out.append({"stats": stats, "report": build_report(db, k, stats, user.language)})
    return out


class MsgIn(BaseModel):
    student_id: int
    text: str = Field(min_length=1, max_length=500)
    lang: str | None = None  # language the text is written in (defaults to the parent's own)


@router.get("/messages")
def messages(user: User = Depends(parent_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(Message).where((Message.to_id == user.id) | (Message.from_id == user.id)).order_by(Message.created_at.desc()).limit(30)).all()
    out = []
    for r in rows:
        mine = r.from_id == user.id
        text = r.text if mine else (r.translated or {}).get(user.language, r.text)
        out.append({"id": r.id, "mine": mine, "text": text, "at": iso(r.created_at)})
    return out


@router.post("/messages")
def send(body: MsgIn, user: User = Depends(parent_only), db: Session = Depends(get_db)):
    kid = db.get(User, body.student_id)
    if not kid or kid.parent_id != user.id:
        raise HTTPException(403, "You can only write about your own child.")
    teacher = db.scalar(select(User).where(User.role == "teacher"))
    src = body.lang if body.lang in LANGUAGES else user.language
    r = translation.translate(db, body.text, src, "hi", allow_similar=False) if src != "hi" else None
    shown = r.text if r and r.status in ("verified", "draft") else body.text
    db.add(Message(from_id=user.id, to_id=teacher.id, student_id=kid.id, text=body.text, lang=src, translated={"hi": shown}))
    db.commit()
    return {"ok": True, "translated": bool(r and r.status in ("verified", "draft")) or src == "hi"}
