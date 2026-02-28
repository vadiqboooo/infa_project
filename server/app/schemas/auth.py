"""Schemas for Telegram authentication."""

from pydantic import BaseModel


class TelegramAuthData(BaseModel):
    """Data received from Telegram Login Widget."""
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
