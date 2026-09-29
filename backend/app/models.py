from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    """Naive UTC timestamps (portable across SQLite / PostgreSQL)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(10), index=True)  # student | teacher | parent
    language: Mapped[str] = mapped_column(String(6), default="hi")  # mother tongue
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avatar: Mapped[str] = mapped_column(String(8), default="🙂")
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    title_en: Mapped[str] = mapped_column(String(160))
    title_hi: Mapped[str] = mapped_column(String(160))
    subject: Mapped[str] = mapped_column(String(30))
    grade: Mapped[int] = mapped_column(Integer)
    emoji: Mapped[str] = mapped_column(String(8), default="📘")
    minutes: Mapped[int] = mapped_column(Integer, default=5)
    sections: Mapped[list] = mapped_column(JSON)  # [{id,en,hi}]
    vocab: Mapped[list] = mapped_column(JSON)  # [{en,hi,emoji}]
    quiz: Mapped[list] = mapped_column(JSON)  # [{id,q:{en,hi},options:[{en,hi}],answer}]


class Translation(Base):
    """Translation memory. Bhashini drafts land here, teachers verify them,
    and verified entries are reused offline and by the similarity matcher."""

    __tablename__ = "translations"
    __table_args__ = (UniqueConstraint("src_lang", "tgt_lang", "src_hash", name="uq_tm"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    src_lang: Mapped[str] = mapped_column(String(6), index=True)
    tgt_lang: Mapped[str] = mapped_column(String(6), index=True)
    src_hash: Mapped[str] = mapped_column(String(40), index=True)
    src_text: Mapped[str] = mapped_column(Text)
    tgt_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="draft", index=True)  # draft|verified|rejected
    source: Mapped[str] = mapped_column(String(20), default="seed")  # seed|bhashini|public|teacher
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Attempt(Base):
    """Every learning event: lesson read, quiz, pronunciation practice."""

    __tablename__ = "attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)  # idempotent sync
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(12), index=True)  # lesson|quiz|practice
    score: Mapped[float] = mapped_column(Float, default=0)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(6), default="hi")
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Confusion(Base):
    __tablename__ = "confusions"
    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[str | None] = mapped_column(String(60), unique=True, nullable=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("class_sessions.id"), nullable=True)
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ClassSession(Base):
    __tablename__ = "class_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(160))
    source_lang: Mapped[str] = mapped_column(String(6), default="hi")
    is_live: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    utterances: Mapped[list["Utterance"]] = relationship(back_populates="session", order_by="Utterance.seq")


class Utterance(Base):
    __tablename__ = "utterances"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(6))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    session: Mapped[ClassSession] = relationship(back_populates="utterances")


class Word(Base):
    """Community dictionary (Bhasha Kosh) - digitising tribal vocabulary."""

    __tablename__ = "words"
    id: Mapped[int] = mapped_column(primary_key=True)
    language: Mapped[str] = mapped_column(String(6), index=True)
    term: Mapped[str] = mapped_column(String(120))
    meaning_en: Mapped[str] = mapped_column(String(160))
    meaning_hi: Mapped[str | None] = mapped_column(String(160), nullable=True)
    audio: Mapped[str | None] = mapped_column(Text, nullable=True)  # data: URL, small clips only
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft|verified
    contributor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Message(Base):
    """Parent <-> teacher bridge; text is auto-translated for the receiver."""

    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    from_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    to_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(6))
    translated: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {lang: text}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
