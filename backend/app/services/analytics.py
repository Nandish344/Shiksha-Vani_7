"""Progress analytics, early-warning alerts and adaptive lesson recommendations."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..languages import LANGUAGES
from ..models import Attempt, Confusion, Lesson, User, iso, utcnow


def _avg(xs):
    xs = list(xs)
    return round(mean(xs)) if xs else None


def load_attempts(db: Session, student_ids: list[int], days: int = 45) -> dict[int, list[Attempt]]:
    since = utcnow() - timedelta(days=days)
    rows = db.scalars(
        select(Attempt).where(Attempt.student_id.in_(student_ids), Attempt.created_at >= since).order_by(Attempt.created_at)
    ).all()
    out: dict[int, list[Attempt]] = defaultdict(list)
    for r in rows:
        out[r.student_id].append(r)
    return out


def streak_days(attempts: list[Attempt], now: datetime) -> int:
    days = {a.created_at.date() for a in attempts}
    d = now.date()
    if d not in days:
        d -= timedelta(days=1)
    n = 0
    while d in days:
        n += 1
        d -= timedelta(days=1)
    return n


def stars_for(attempts: list[Attempt]) -> int:
    total = 0
    for a in attempts:
        if a.kind in ("quiz", "practice"):
            total += 1 + (a.score >= 80) + (a.score >= 95)
        elif a.kind == "lesson":
            total += 1
    return int(total)


def student_stats(student: User, attempts: list[Attempt], lessons: dict[int, Lesson], now: datetime | None = None) -> dict:
    now = now or utcnow()
    quizzes = [a for a in attempts if a.kind == "quiz"]
    practice = [a for a in attempts if a.kind == "practice"]
    last = attempts[-1].created_at if attempts else None
    week = [a.score for a in quizzes if a.created_at >= now - timedelta(days=7)]
    prev = [a.score for a in quizzes if now - timedelta(days=14) <= a.created_at < now - timedelta(days=7)]
    subjects: dict[str, list[float]] = defaultdict(list)
    for a in quizzes:
        if a.lesson_id in lessons:
            subjects[lessons[a.lesson_id].subject].append(a.score)
    return {
        "id": student.id,
        "name": student.name,
        "avatar": student.avatar,
        "language": student.language,
        "grade": student.grade,
        "village": student.village,
        "comprehension": _avg(a.score for a in quizzes[-10:]),
        "pronunciation": _avg(a.score for a in practice[-10:]),
        "week_avg": _avg(week),
        "prev_week_avg": _avg(prev),
        "streak": streak_days(attempts, now),
        "stars": stars_for(attempts),
        "lessons_done": len({a.lesson_id for a in attempts if a.kind == "lesson" and a.lesson_id}),
        "last_active": iso(last),
        "days_inactive": (now.date() - last.date()).days if last else None,
        "subjects": {k: _avg(v) for k, v in subjects.items()},
    }


def student_alerts(stats: dict, confusions_7d: int) -> list[dict]:
    lang = LANGUAGES.get(stats["language"], {}).get("name", stats["language"])
    sid, name = stats["id"], stats["name"].split()[0]
    out = []

    def add(kind, severity, title, detail, suggestion):
        out.append({"student_id": sid, "student": stats["name"], "avatar": stats["avatar"], "language": stats["language"],
                    "kind": kind, "severity": severity, "title": title, "detail": detail, "suggestion": suggestion})

    comp = stats["comprehension"]
    if comp is not None and comp < 65:
        add("low_comprehension", "high" if comp < 60 else "medium", f"{name} is finding lessons hard",
            f"Comprehension is {comp}% over the last 10 quizzes.",
            f"Re-teach the last topic with picture cards and pair {name} with a {lang}-speaking buddy.")
    di = stats["days_inactive"]
    if di is None or di >= 3:
        add("inactive", "high" if (di is None or di >= 5) else "medium", f"{name} has not practised lately",
            "No activity yet." if di is None else f"No activity for {di} days.",
            f"Send a voice note to the parent in {lang} and check for attendance issues.")
    w, p = stats["week_avg"], stats["prev_week_avg"]
    if w is not None and p is not None and p - w >= 12:
        add("declining", "medium", f"{name}'s scores are dropping", f"Quiz average fell from {p}% to {w}% this week.",
            "Ask what changed - a new topic, absence, or trouble at home - and revisit the previous lesson.")
    if confusions_7d >= 3:
        add("confused", "medium", f"{name} keeps signalling confusion", f"Pressed 'I did not understand' {confusions_7d} times this week.",
            "Slow the pace and check the translated captions for that topic in the review queue.")
    pr = stats["pronunciation"]
    if pr is not None and pr < 55:
        add("pronunciation", "low", f"{name} needs reading practice", f"Reading score is {pr}%.", "Give 5 minutes of Speech Practice daily with the shorter sentences.")
    return out


def recommendations(student: User, attempts: list[Attempt], lessons: list[Lesson], lang: str, limit: int = 3) -> list[dict]:
    seen = {a.lesson_id for a in attempts if a.kind == "lesson"}
    last_quiz: dict[int, float] = {}
    for a in attempts:
        if a.kind == "quiz" and a.lesson_id:
            last_quiz[a.lesson_id] = a.score
    scored = []
    for l in lessons:
        gap = abs((student.grade or 3) - l.grade)
        if l.id in last_quiz and last_quiz[l.id] < 70:
            scored.append((0 + gap * 0.1, l, "retry", f"You scored {round(last_quiz[l.id])}%. Try again!"))
        elif l.id not in seen:
            scored.append((1 + gap, l, "new", "New for you"))
        elif l.id not in last_quiz:
            scored.append((2 + gap, l, "quiz", "Take the quiz"))
    scored.sort(key=lambda t: t[0])
    return [{"lesson_id": l.id, "reason": r, "label": label} for _, l, r, label in scored[:limit]]


def class_overview(db: Session, teacher_id: int | None = None) -> dict:
    now = utcnow()
    students = db.scalars(select(User).where(User.role == "student").order_by(User.name)).all()
    lessons = {l.id: l for l in db.scalars(select(Lesson)).all()}
    att = load_attempts(db, [s.id for s in students])
    conf_rows = db.scalars(select(Confusion).where(Confusion.created_at >= now - timedelta(days=7))).all()
    conf_by: dict[int, int] = defaultdict(int)
    for c in conf_rows:
        conf_by[c.student_id] += 1

    stats = [student_stats(s, att.get(s.id, []), lessons, now) for s in students]
    alerts = []
    for st in stats:
        alerts.extend(student_alerts(st, conf_by.get(st["id"], 0)))
    order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (order[a["severity"]], a["student"]))

    active_today = sum(1 for st in stats if st["days_inactive"] == 0)
    active_week = sum(1 for st in stats if st["days_inactive"] is not None and st["days_inactive"] <= 7)
    by_lang: dict[str, int] = defaultdict(int)
    comp_by_lang: dict[str, list[int]] = defaultdict(list)
    for st in stats:
        by_lang[st["language"]] += 1
        if st["comprehension"] is not None:
            comp_by_lang[st["language"]].append(st["comprehension"])

    trend = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_scores = [a.score for lst in att.values() for a in lst if a.kind == "quiz" and a.created_at.date() == day]
        day_active = {a.student_id for lst in att.values() for a in lst if a.created_at.date() == day}
        trend.append({"date": day.isoformat(), "comprehension": _avg(day_scores), "active": len(day_active)})

    subj: dict[str, list[float]] = defaultdict(list)
    for lst in att.values():
        for a in lst:
            if a.kind == "quiz" and a.lesson_id in lessons:
                subj[lessons[a.lesson_id].subject].append(a.score)

    comps = [st["comprehension"] for st in stats if st["comprehension"] is not None]
    return {
        "kpis": {
            "students": len(stats),
            "active_today": active_today,
            "active_week": active_week,
            "languages": len(by_lang),
            "avg_comprehension": _avg(comps),
            "needs_support": len({a["student_id"] for a in alerts if a["severity"] in ("high", "medium")}),
        },
        "languages": [
            {"code": c, "name": LANGUAGES[c]["name"], "native": LANGUAGES[c]["native"], "students": n, "comprehension": _avg(comp_by_lang.get(c, []))}
            for c, n in sorted(by_lang.items(), key=lambda kv: -kv[1])
        ],
        "trend": trend,
        "subjects": [{"subject": k, "score": _avg(v)} for k, v in sorted(subj.items())],
        "alerts": alerts,
        "students": stats,
        "confusions_7d": len(conf_rows),
    }
