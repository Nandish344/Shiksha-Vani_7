"""Demo data: 1 teacher, 32 students (4 tribal languages), 30 days of learning history,
lessons, translation memory, community dictionary. Deterministic (seeded RNG)."""
import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content import GLOSSARY, LESSONS, PHRASES
from .db import Base, engine
from .models import Attempt, ClassSession, Confusion, Lesson, Translation, User, Utterance, Word, utcnow
from .security import hash_password
from .services.text import text_hash

DEMO_PASSWORD = "demo123"

STUDENTS = {
    "sat": ["Sona Murmu", "Ramesh Hembrom", "Lakhi Soren", "Mangal Tudu", "Champa Kisku", "Budhan Baskey", "Saheb Marandi", "Dulari Besra"],
    "unr": ["Anita Purty", "Sukra Munda", "Dulari Guria", "Raju Sanga", "Kamli Tuti", "Mangra Hassa", "Basanti Pahan", "Jitu Bodra"],
    "hoc": ["Birsa Ho", "Jamuna Sinku", "Deepak Purty", "Rani Bodra", "Sanjay Laguri", "Mukta Kaudi", "Ghanshyam Hansda", "Parvati Champia"],
    "kru": ["Sunita Kujur", "Anil Toppo", "Manju Lakra", "Prakash Ekka", "Rekha Minj", "Suresh Tirkey", "Geeta Xalxo", "Bablu Bara"],
}
AVATARS = ["🧒", "👧", "👦", "🧑🏽", "👧🏽", "👦🏽", "🧒🏾", "👧🏾"]
VILLAGES = ["Baharagora", "Chakulia", "Dhalbhumgarh", "Ghatshila", "Musabani", "Potka"]
AT_RISK = {"Sona Murmu": (58, 0.0), "Birsa Ho": (61, 0.0)}
DECLINING = {"Manju Lakra": (84, -0.9)}
INACTIVE = {"Jitu Bodra": 6, "Bablu Bara": 4}  # days since last activity


def _username(name: str, taken: set) -> str:
    base = name.split()[0].lower()
    u, n = base, 2
    while u in taken:
        u, n = f"{base}{n}", n + 1
    taken.add(u)
    return u


def seed_if_empty(db: Session) -> bool:
    Base.metadata.create_all(engine)
    if db.scalar(select(User.id).limit(1)):
        return False
    rng = random.Random(2026)
    now = utcnow()
    pw = hash_password(DEMO_PASSWORD)

    # --- lessons ------------------------------------------------------------
    lessons = []
    for l in LESSONS:
        row = Lesson(**l)
        db.add(row)
        lessons.append(row)
    db.flush()

    # --- users --------------------------------------------------------------
    taken: set = {"teacher", "parent"}
    teacher = User(username="teacher", password_hash=pw, name="Meena Kumari", role="teacher", language="hi", avatar="👩🏽‍🏫", village="Baharagora")
    db.add(teacher)
    students = []
    for lang, names in STUDENTS.items():
        for i, name in enumerate(names):
            u = User(username=_username(name, taken), password_hash=pw, name=name, role="student", language=lang,
                     grade=rng.choice([2, 3, 3, 3, 4, 4, 5]) if name != "Sona Murmu" else 3,
                     avatar=AVATARS[i % len(AVATARS)], village=rng.choice(VILLAGES))
            db.add(u)
            students.append(u)
    db.flush()
    sona = next(s for s in students if s.name == "Sona Murmu")
    parent = User(username="parent", password_hash=pw, name="Sukhram Murmu", role="parent", language="sat", avatar="🧔🏽", village=sona.village)
    db.add(parent)
    db.flush()
    sona.parent_id = parent.id

    # --- 30 days of learning history ----------------------------------------
    for s in students:
        base, trend = AT_RISK.get(s.name) or DECLINING.get(s.name) or (rng.gauss(79, 7), 0.22)
        quiet_days = INACTIVE.get(s.name, 0)
        eligible = [l for l in lessons if l.grade <= (s.grade or 3) + 1] or lessons
        for d in range(30, -1, -1):
            if d < quiet_days or rng.random() > (0.66 if s.name not in AT_RISK else 0.5):
                continue
            skill = base + trend * (30 - d)
            for _ in range(rng.choice([1, 1, 2])):
                lesson = rng.choice(eligible)
                when = now - timedelta(days=d, hours=rng.randint(0, 5), minutes=rng.randint(0, 59))
                if d == 0:
                    when = now - timedelta(minutes=rng.randint(5, 240))
                db.add(Attempt(student_id=s.id, lesson_id=lesson.id, kind="lesson", score=100, seconds=rng.randint(200, 420), language=s.language, created_at=when))
                q = max(20, min(100, round(rng.gauss(skill, 7))))
                db.add(Attempt(student_id=s.id, lesson_id=lesson.id, kind="quiz", score=q, seconds=rng.randint(60, 150), language=s.language, created_at=when + timedelta(minutes=6)))
                if rng.random() < 0.35:
                    p = max(15, min(100, round(rng.gauss(skill - 6, 9))))
                    db.add(Attempt(student_id=s.id, lesson_id=lesson.id, kind="practice", score=p, seconds=rng.randint(20, 60), language=s.language, created_at=when + timedelta(minutes=12)))

    # --- pin the two students shown in the SIH deck so the demo matches the slides exactly ---
    db.flush()
    for who, target in ((sona, 58), (next(x for x in students if x.name == "Birsa Ho"), 61)):
        last = db.scalars(select(Attempt).where(Attempt.student_id == who.id, Attempt.kind == "quiz").order_by(Attempt.created_at.desc()).limit(10)).all()
        delta = target * len(last) - sum(a.score for a in last)
        for i, a in enumerate(last):
            step = delta // len(last) + (1 if i < delta % len(last) else 0)
            a.score = max(20, min(100, a.score + step))

    # --- confusion signals (last week) ---------------------------------------
    birsa = next(s for s in students if s.name == "Birsa Ho")
    for who, n in ((sona, 4), (birsa, 3), (rng.choice(students), 1), (rng.choice(students), 1)):
        for _ in range(n):
            db.add(Confusion(student_id=who.id, lesson_id=rng.choice(lessons).id, created_at=now - timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 5))))

    # --- a past live class for the recap screen -------------------------------
    sess = ClassSession(code="SV-1001", teacher_id=teacher.id, title="Plants around us", source_lang="hi", is_live=False,
                        started_at=now - timedelta(days=1, hours=3), ended_at=now - timedelta(days=1, hours=2, minutes=20))
    db.add(sess)
    db.flush()
    for i, en_hi in enumerate([PHRASES[0], PHRASES[9], LESSONS[0]["sections"][0], LESSONS[0]["sections"][1], LESSONS[0]["sections"][2], PHRASES[6], PHRASES[7]]):
        text = en_hi[1] if isinstance(en_hi, tuple) else en_hi["hi"]
        db.add(Utterance(session_id=sess.id, seq=i + 1, text=text, lang="hi", created_at=sess.started_at + timedelta(minutes=i * 4)))

    # --- translation memory ---------------------------------------------------
    seen: set = set()

    def tm(src, tgt, s, t, status="verified", source="seed"):
        key = (src, tgt, text_hash(s))
        if key in seen or not s or not t:
            return
        seen.add(key)
        db.add(Translation(src_lang=src, tgt_lang=tgt, src_hash=key[2], src_text=s, tgt_text=t, status=status, source=source))

    def pair(en, hi):
        tm("en", "hi", en, hi)
        tm("hi", "en", hi, en)

    for l in LESSONS:
        pair(l["title_en"], l["title_hi"])
        for s in l["sections"]:
            pair(s["en"], s["hi"])
        for v in l["vocab"]:
            pair(v["en"], v["hi"])
        for q in l["quiz"]:
            pair(q["q"]["en"], q["q"]["hi"])
            for o in q["options"]:
                pair(o["en"], o["hi"])
    for en, hi in PHRASES:
        pair(en, hi)

    # --- tribal glossary: TM (draft) + community dictionary -------------------
    for en, (hi, terms) in GLOSSARY.items():
        for lang, term in terms.items():
            for src, text in (("en", en), ("hi", hi)):
                tm(src, lang, text, term, status="draft")
            tm(lang, "en", term, en, status="draft")
            tm(lang, "hi", term, hi, status="draft")
            db.add(Word(language=lang, term=term, meaning_en=en, meaning_hi=hi, status="draft", contributor_id=teacher.id))

    db.commit()
    return True
