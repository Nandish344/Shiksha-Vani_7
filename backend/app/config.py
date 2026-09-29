"""Central configuration, read from environment (.env supported)."""
import os

try:  # optional dependency
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./shikshavani.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_HOURS: int = int(os.getenv("JWT_HOURS", "72"))
    DEMO_MODE: bool = _bool("DEMO_MODE", True)
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]

    BHASHINI_USER_ID: str = os.getenv("BHASHINI_USER_ID", "")
    BHASHINI_API_KEY: str = os.getenv("BHASHINI_API_KEY", "")
    ENABLE_PUBLIC_FALLBACK: bool = _bool("ENABLE_PUBLIC_FALLBACK", False)
    WHISPER_API_URL: str = os.getenv("WHISPER_API_URL", "")
    WHISPER_API_KEY: str = os.getenv("WHISPER_API_KEY", "")

    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")


settings = Settings()
