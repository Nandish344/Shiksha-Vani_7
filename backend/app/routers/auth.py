from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..languages import LANGUAGES
from ..models import User
from ..security import current_user, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "role": u.role, "language": u.language,
            "grade": u.grade, "avatar": u.avatar, "village": u.village}


class LoginIn(BaseModel):
    username: str
    password: str


class ProfileIn(BaseModel):
    language: str | None = None
    grade: int | None = None


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Username or password is not correct.")
    return {"token": make_token(user), "user": user_out(user)}


@router.post("/demo/{username}")
def demo_login(username: str, db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        raise HTTPException(404, "Demo mode is off.")
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(404, "Demo user not found.")
    return {"token": make_token(user), "user": user_out(user)}


@router.get("/demo-users")
def demo_users(db: Session = Depends(get_db)):
    if not settings.DEMO_MODE:
        return []
    picks = ["teacher", "parent", "sona", "anita", "birsa", "sunita"]
    users = {u.username: u for u in db.scalars(select(User).where(User.username.in_(picks))).all()}
    return [user_out(users[p]) for p in picks if p in users]


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.patch("/me")
def update_me(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.language:
        if body.language not in LANGUAGES:
            raise HTTPException(400, "Unknown language.")
        user.language = body.language
    if body.grade and user.role == "student":
        user.grade = max(1, min(5, body.grade))
    db.commit()
    return user_out(user)
