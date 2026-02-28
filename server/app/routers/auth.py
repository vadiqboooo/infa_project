"""Auth router — Telegram Login Widget verification + JWT issuance."""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db
from app.models.user import User
from app.schemas.auth import TelegramAuthData, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _verify_telegram_hash(data: TelegramAuthData) -> bool:
    """Validate the Telegram login hash via HMAC-SHA256."""
    secret_key = hashlib.sha256(settings.BOT_TOKEN.encode()).digest()

    check_pairs = []
    for key in sorted(data.model_dump(exclude={"hash"}).keys()):
        value = getattr(data, key)
        if value is not None:
            check_pairs.append(f"{key}={value}")
    check_string = "\n".join(check_pairs)

    computed_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, data.hash)


def _create_jwt(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/telegram", response_model=TokenResponse)
async def auth_telegram(body: TelegramAuthData, db: AsyncSession = Depends(get_db)):
    """Authenticate via Telegram Login Widget data."""
    if not _verify_telegram_hash(body):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram hash")

    # Upsert user
    result = await db.execute(select(User).where(User.tg_id == body.id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            tg_id=body.id,
            username=body.username,
            first_name=body.first_name,
            photo_url=body.photo_url,
        )
        db.add(user)
    else:
        user.username = body.username
        user.first_name = body.first_name
        user.photo_url = body.photo_url

    await db.commit()
    await db.refresh(user)

    token = _create_jwt(user.id)
    return TokenResponse(access_token=token)
