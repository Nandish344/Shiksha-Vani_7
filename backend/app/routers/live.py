"""Live classroom: teacher speaks -> ASR (in the browser or server) -> translation -> every
student's screen, in their own mother tongue, within a second or two.

Single-process room manager (fine for a school / demo). For multi-instance deployments swap the
`Room` broadcast for Redis pub/sub - the message protocol stays the same."""
from __future__ import annotations

import asyncio
import logging
import random

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_db
from ..languages import LANGUAGES
from ..models import ClassSession, Confusion, User, Utterance, iso, utcnow
from ..security import decode_token, require_role
from ..services.translation import translate
from .learn import localized_lesson  # noqa: F401  (kept for future lesson-sync messages)

log = logging.getLogger("live")
router = APIRouter(tags=["live"])


class Room:
    def __init__(self, session_id: int, code: str, teacher_id: int, source_lang: str):
        self.session_id, self.code, self.teacher_id, self.source_lang = session_id, code, teacher_id, source_lang
        self.teacher: WebSocket | None = None
        self.students: dict[WebSocket, dict] = {}
        self.seq = 0

    def presence(self) -> dict:
        people = [{"id": u["id"], "name": u["name"], "avatar": u["avatar"], "language": u["language"]} for u in self.students.values()]
        return {"type": "presence", "students": people, "teacher_online": self.teacher is not None}

    async def send_all(self, msg: dict, teacher: bool = True, students: bool = True):
        targets = ([self.teacher] if teacher and self.teacher else []) + (list(self.students) if students else [])
        for ws in targets:
            try:
                await ws.send_json(msg)
            except Exception:
                self.students.pop(ws, None)
                if ws is self.teacher:
                    self.teacher = None


rooms: dict[str, Room] = {}


def _session_out(s: ClassSession, db: Session | None = None) -> dict:
    room = rooms.get(s.code)
    return {"id": s.id, "code": s.code, "title": s.title, "source_lang": s.source_lang, "is_live": s.is_live,
            "started_at": iso(s.started_at), "ended_at": iso(s.ended_at), "listeners": len(room.students) if room else 0}


class StartIn(BaseModel):
    title: str = Field(default="Today's class", max_length=160)
    source_lang: str = "hi"


@router.post("/api/sessions")
def start_session(body: StartIn, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    if body.source_lang not in LANGUAGES:
        raise HTTPException(400, "Unsupported language.")
    for old in db.scalars(select(ClassSession).where(ClassSession.teacher_id == user.id, ClassSession.is_live == True)).all():  # noqa: E712
        old.is_live, old.ended_at = False, utcnow()
    code = f"SV-{random.randint(1000, 9999)}"
    s = ClassSession(code=code, teacher_id=user.id, title=body.title.strip() or "Today's class", source_lang=body.source_lang)
    db.add(s)
    db.commit()
    rooms[code] = Room(s.id, code, user.id, s.source_lang)
    return _session_out(s)


@router.post("/api/sessions/{session_id}/end")
def end_session(session_id: int, user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    s = db.get(ClassSession, session_id)
    if not s or s.teacher_id != user.id:
        raise HTTPException(404, "Class not found.")
    s.is_live, s.ended_at = False, utcnow()
    db.commit()
    return _session_out(s)


@router.get("/api/sessions/live")
def live_sessions(user: User = Depends(require_role("student", "teacher", "parent")), db: Session = Depends(get_db)):
    rows = db.scalars(select(ClassSession).where(ClassSession.is_live == True).order_by(ClassSession.started_at.desc())).all()  # noqa: E712
    return [_session_out(s) for s in rows]


@router.get("/api/sessions/recent")
def recent_sessions(user: User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    rows = db.scalars(select(ClassSession).where(ClassSession.teacher_id == user.id).order_by(ClassSession.started_at.desc()).limit(6)).all()
    counts = dict(db.execute(select(Utterance.session_id, func.count()).group_by(Utterance.session_id)).all())
    return [{**_session_out(s), "lines": counts.get(s.id, 0)} for s in rows]


# ------------------------------------------------------------------ websocket
def _translate_all(text: str, src: str, langs: set[str]) -> dict:
    db = SessionLocal()
    try:
        out = {}
        for lang in langs:
            if lang == src:
                continue
            out[lang] = translate(db, text, src, lang, min_similarity=0.8).dict()
        return out
    finally:
        db.close()


def _save_utterance(session_id: int, seq: int, text: str, lang: str) -> None:
    db = SessionLocal()
    try:
        db.add(Utterance(session_id=session_id, seq=seq, text=text, lang=lang))
        db.commit()
    finally:
        db.close()


def _save_confusion(student_id: int, session_id: int, note: str | None) -> int:
    db = SessionLocal()
    try:
        db.add(Confusion(student_id=student_id, session_id=session_id, note=note))
        db.commit()
        return db.scalar(select(func.count()).select_from(Confusion).where(Confusion.session_id == session_id)) or 0
    finally:
        db.close()


def _load(code: str, token: str):
    db = SessionLocal()
    try:
        try:
            uid = decode_token(token)
        except HTTPException:
            return None, None, "auth"
        user = db.get(User, uid)
        sess = db.scalar(select(ClassSession).where(ClassSession.code == code))
        if not user or not sess or not sess.is_live:
            return None, None, "gone"
        return {"id": user.id, "name": user.name, "role": user.role, "language": user.language, "avatar": user.avatar}, \
               {"id": sess.id, "code": sess.code, "title": sess.title, "teacher_id": sess.teacher_id, "source_lang": sess.source_lang}, None
    finally:
        db.close()


@router.websocket("/ws/session/{code}")
async def session_socket(ws: WebSocket, code: str, token: str = ""):
    user, sess, err = await run_in_threadpool(_load, code, token)
    if err:
        await ws.close(code=4401 if err == "auth" else 4404)
        return
    await ws.accept()
    room = rooms.get(code)
    if not room:  # server restarted while class was live
        room = rooms[code] = Room(sess["id"], code, sess["teacher_id"], sess["source_lang"])
    is_teacher = user["role"] == "teacher" and user["id"] == room.teacher_id
    if is_teacher:
        room.teacher = ws
    elif user["role"] in ("student", "parent"):
        room.students[ws] = user
    else:
        await ws.close(code=4403)
        return

    await ws.send_json({"type": "hello", "role": "teacher" if is_teacher else "student", "session": {**sess}, "seq": room.seq})
    await room.send_all(room.presence())
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            if is_teacher and kind == "interim":
                await room.send_all({"type": "interim", "text": str(msg.get("text", ""))[:300], "lang": room.source_lang}, teacher=False)
            elif is_teacher and kind == "utterance":
                text = str(msg.get("text", "")).strip()[:400]
                if not text:
                    continue
                room.seq += 1
                seq = room.seq
                langs = {u["language"] for u in room.students.values()} | {"en", "hi"}
                translations = await run_in_threadpool(_translate_all, text, room.source_lang, langs)
                await run_in_threadpool(_save_utterance, room.session_id, seq, text, room.source_lang)
                await room.send_all({"type": "caption", "seq": seq, "text": text, "lang": room.source_lang, "translations": translations, "at": iso(utcnow())})
            elif is_teacher and kind == "patch":
                # Teacher just wrote / corrected a translation: update children's screens live.
                lang, ptext = str(msg.get("lang", "")), str(msg.get("text", "")).strip()[:600]
                if lang in LANGUAGES and ptext:
                    await room.send_all({"type": "caption_patch", "seq": msg.get("seq"), "lang": lang, "text": ptext})
            elif is_teacher and kind == "end":
                await room.send_all({"type": "ended"})
                break
            elif not is_teacher and kind == "confused":
                total = await run_in_threadpool(_save_confusion, user["id"], room.session_id, (msg.get("note") or None))
                await room.send_all({"type": "confusion", "student_id": user["id"], "name": user["name"], "avatar": user["avatar"], "total": total}, students=False)
            elif not is_teacher and kind == "got_it":
                await room.send_all({"type": "got_it", "student_id": user["id"], "name": user["name"]}, students=False)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:  # malformed JSON etc.
        log.info("socket closed: %s", e)
    finally:
        if is_teacher:
            room.teacher = None
        room.students.pop(ws, None)
        await room.send_all(room.presence())
