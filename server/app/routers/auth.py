"""Auth router — Telegram Login Widget verification + JWT issuance + login/password auth."""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
import bcrypt as _bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginAuthData, TelegramAuthData, TokenResponse, UserSchema, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())


@router.get("/me", response_model=UserSchema)
async def get_me(user: User = Depends(get_current_user)):
    """Return currently authenticated user's profile."""
    return user


@router.put("/me", response_model=UserSchema)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's personal details (real name)."""
    if body.first_name_real is not None:
        user.first_name_real = body.first_name_real
    if body.last_name_real is not None:
        user.last_name_real = body.last_name_real

    await db.commit()
    await db.refresh(user)
    return user


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


@router.post("/login", response_model=TokenResponse)
async def auth_login(body: LoginAuthData, db: AsyncSession = Depends(get_db)):
    """Authenticate via login and password (for students without Telegram)."""
    result = await db.execute(select(User).where(User.login == body.login))
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    if not _verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    token = _create_jwt(user.id)
    return TokenResponse(access_token=token)
