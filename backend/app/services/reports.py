"""Plain-language progress reports for parents, in the parent's own language."""
from sqlalchemy.orm import Session

from ..languages import LANGUAGES
from .translation import translate

SUBJECT_HI = {"EVS": "पर्यावरण अध्ययन", "Maths": "गणित", "Language": "भाषा"}


def _lines(name: str, stats: dict, mother: str) -> tuple[list[dict], list[dict]]:
    lang_name = LANGUAGES.get(mother, {}).get("name", mother)
    lines, tips = [], []
    comp, streak, di = stats["comprehension"], stats["streak"], stats["days_inactive"]

    if comp is not None:
        st = "good" if comp >= 75 else "ok" if comp >= 60 else "help"
        lines.append({"key": "comprehension", "status": st, "en": f"{name} scored {comp}% in recent quizzes.", "hi": f"{name} ने हाल की प्रश्नोत्तरी में {comp}% अंक पाए।"})
    if streak >= 2:
        lines.append({"key": "streak", "status": "good", "en": f"{name} studied {streak} days in a row.", "hi": f"{name} ने लगातार {streak} दिन पढ़ाई की।"})
    subj = {k: v for k, v in stats["subjects"].items() if v is not None}
    if subj:
        best = max(subj, key=subj.get)
        lines.append({"key": "best", "status": "good", "en": f"Strongest subject: {best}.", "hi": f"सबसे मज़बूत विषय: {SUBJECT_HI.get(best, best)}।"})
        worst = min(subj, key=subj.get)
        if subj[worst] < 70 and worst != best:
            lines.append({"key": "worst", "status": "help", "en": f"{worst} needs a little more practice.", "hi": f"{SUBJECT_HI.get(worst, worst)} में थोड़े और अभ्यास की ज़रूरत है।"})
    if di is not None and di >= 3:
        lines.append({"key": "inactive", "status": "help", "en": f"{name} has not practised for {di} days.", "hi": f"{name} ने {di} दिन से अभ्यास नहीं किया।"})

    tips.append({"key": "tip_word", "en": f"Ask {name} to teach you one new {lang_name} word today.", "hi": f"आज {name} से {lang_name} का एक नया शब्द सिखाने को कहें।"})
    if comp is not None and comp < 65:
        tips.append({"key": "tip_read", "en": f"Listen to {name} read aloud for 5 minutes in the evening.", "hi": f"शाम को 5 मिनट {name} को ज़ोर से पढ़ते हुए सुनें।"})
    else:
        tips.append({"key": "tip_praise", "en": f"Praise {name} for the effort. It builds confidence.", "hi": f"{name} की मेहनत की तारीफ़ करें। इससे आत्मविश्वास बढ़ता है।"})
    return lines, tips


def build_report(db: Session, student, stats: dict, lang: str) -> dict:
    name = student.name.split()[0]
    lines, tips = _lines(name, stats, student.language)

    def localize(item):
        if lang in ("en", "hi"):
            return {**item, "text": item[lang], "lang": lang, "translated": True}
        r = translate(db, item["hi"], "hi", lang, allow_similar=False)
        ok = r.status in ("verified", "draft")
        return {**item, "text": r.text if ok else item["hi"], "lang": lang if ok else "hi", "translated": ok}

    status = "good"
    comp = stats["comprehension"]
    if (comp is not None and comp < 60) or (stats["days_inactive"] or 0) >= 5:
        status = "help"
    elif comp is not None and comp < 75:
        status = "ok"
    return {
        "student": {"id": student.id, "name": student.name, "avatar": student.avatar, "grade": student.grade, "language": student.language, "village": student.village},
        "status": status,
        "numbers": {k: stats[k] for k in ("comprehension", "pronunciation", "streak", "stars", "lessons_done")},
        "lines": [localize(x) for x in lines],
        "tips": [localize(x) for x in tips],
        "subjects": stats["subjects"],
        "report_lang": lang,
    }
