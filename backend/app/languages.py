"""Language registry. Codes are ISO 639 (Bhashini uses the same codes)."""

LANGUAGES = {
    "hi": {"name": "Hindi", "native": "हिन्दी", "tts": "hi-IN", "stt": "hi-IN", "tribal": False, "public_mt": True},
    "en": {"name": "English", "native": "English", "tts": "en-IN", "stt": "en-IN", "tribal": False, "public_mt": True},
    "bn": {"name": "Bengali", "native": "বাংলা", "tts": "bn-IN", "stt": "bn-IN", "tribal": False, "public_mt": True},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "tts": "or-IN", "stt": "or-IN", "tribal": False, "public_mt": True},
    "sat": {"name": "Santali", "native": "ᱥᱟᱱᱛᱟᱲᱤ", "tts": None, "stt": None, "tribal": True, "public_mt": False},
    "unr": {"name": "Mundari", "native": "मुण्डारी", "tts": None, "stt": None, "tribal": True, "public_mt": False},
    "hoc": {"name": "Ho", "native": "हो", "tts": None, "stt": None, "tribal": True, "public_mt": False},
    "kru": {"name": "Kurukh", "native": "कुड़ुख़", "tts": None, "stt": None, "tribal": True, "public_mt": False},
}

TRIBAL = [c for c, v in LANGUAGES.items() if v["tribal"]]
# Which language does the interface fall back to when there is no UI translation
UI_FALLBACK = {"sat": "hi", "unr": "hi", "hoc": "hi", "kru": "hi", "or": "en"}


def is_supported(code: str) -> bool:
    return code in LANGUAGES
