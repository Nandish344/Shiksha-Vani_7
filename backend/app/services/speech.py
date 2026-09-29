"""Reading / pronunciation scoring from an ASR transcript + optional server-side ASR."""
import base64
import difflib

import httpx

from ..config import settings
from .bhashini import BhashiniError, bhashini
from .text import normalize


def score_reading(target: str, spoken: str, seconds: float | None = None) -> dict:
    t_words = normalize(target).split()
    s_words = normalize(spoken).split()
    if not t_words:
        return {"accuracy": 0, "fluency": None, "score": 0, "stars": 0, "words": []}

    status = ["missed"] * len(t_words)
    sm = difflib.SequenceMatcher(a=t_words, b=s_words, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                status[i] = "ok"
        elif tag == "replace":
            for offset, i in enumerate(range(i1, i2)):
                j = j1 + offset
                if j < j2:
                    ratio = difflib.SequenceMatcher(a=t_words[i], b=s_words[j]).ratio()
                    status[i] = "ok" if ratio >= 0.9 else "close" if ratio >= 0.6 else "wrong"
                else:
                    status[i] = "missed"

    ok = status.count("ok")
    close = status.count("close")
    accuracy = round((ok + 0.6 * close) / len(t_words) * 100)

    fluency = None
    if seconds and seconds > 0.5 and s_words:
        wpm = len(s_words) / seconds * 60
        # Early readers: ~40-120 wpm is healthy. Penalise very slow / rushed reading gently.
        fluency = 100 if 40 <= wpm <= 120 else max(40, round(100 - min(abs(wpm - (40 if wpm < 40 else 120)) * 1.2, 60)))
    score = accuracy if fluency is None else round(0.8 * accuracy + 0.2 * fluency)
    stars = 3 if score >= 85 else 2 if score >= 65 else 1 if score >= 40 else 0

    words = []
    display = target.split()
    # map normalized words back to display tokens when counts line up (they usually do)
    for i, w in enumerate(t_words):
        words.append({"word": display[i] if len(display) == len(t_words) else w, "status": status[i]})
    return {"accuracy": accuracy, "fluency": fluency, "score": score, "stars": stars, "words": words, "heard": spoken}


def transcribe(audio_b64: str, lang: str) -> dict:
    """Server-side ASR for languages the browser can't recognise (e.g. Santali)."""
    if bhashini.enabled:
        try:
            return {"text": bhashini.asr(audio_b64, lang), "engine": "bhashini"}
        except (BhashiniError, httpx.HTTPError, KeyError):
            pass
    if settings.WHISPER_API_URL:
        raw = base64.b64decode(audio_b64)
        headers = {"Authorization": f"Bearer {settings.WHISPER_API_KEY}"} if settings.WHISPER_API_KEY else {}
        r = httpx.post(
            settings.WHISPER_API_URL,
            headers=headers,
            files={"file": ("speech.wav", raw, "audio/wav")},
            data={"model": "whisper-1", "language": lang if lang in {"hi", "en", "bn"} else ""},
            timeout=30,
        )
        r.raise_for_status()
        return {"text": r.json().get("text", "").strip(), "engine": "whisper"}
    raise RuntimeError("No speech-to-text engine configured")
