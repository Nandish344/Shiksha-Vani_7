import hashlib
import hmac
import os
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User, utcnow

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 60_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 60_000).hex()
    return hmac.compare_digest(candidate, digest)


def make_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role, "exp": utcnow() + timedelta(hours=settings.JWT_HOURS)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> int:
    try:
        data = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expired. Please log in again.")


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if not cred:
        raise HTTPException(401, "Please log in.")
    user = db.get(User, decode_token(cred.credentials))
    if not user:
        raise HTTPException(401, "Account not found.")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "This page is not available for your account.")
        return user

    return dep


def user_from_query_token(token: str = Query(...), db: Session = Depends(get_db)) -> User:
    user = db.get(User, decode_token(token))
    if not user:
        raise HTTPException(401, "Account not found.")
    return user
