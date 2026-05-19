"""Application configuration via environment variables / .env file."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/edu_platform"

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── Telegram ──────────────────────────────────────────────
    BOT_TOKEN: str = ""

    # ── LLM / AI ──────────────────────────────────────────────
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_VISION_MODEL: str = ""

    # ── Parser / Admin API key ────────────────────────────────
    PARSER_API_KEY: str = ""

    # Optional local OCR for solution images.
    # Install the Tesseract binary separately and set this if it is not in PATH.
    TESSERACT_CMD: str = "tesseract"
    TESSERACT_LANG: str = "rus+eng"

    # YooKassa test/live shop credentials
    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_API_URL: str = "https://api.yookassa.ru/v3"
    PAYMENT_RETURN_URL: str = "http://localhost:5173/home"


settings = Settings()
