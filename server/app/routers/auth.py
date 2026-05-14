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
from app.models.group import user_groups
from app.models.user import User
from app.schemas.auth import (
    LoginAuthData,
    PasswordChangeIn,
    RegisterAuthData,
    TelegramAuthData,
    TokenResponse,
    UserSchema,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())


@router.get("/me", response_model=UserSchema)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return currently authenticated user's profile."""
    return await _user_schema(user, db)


async def _user_schema(user: User, db: AsyncSession) -> UserSchema:
    groups_res = await db.execute(select(user_groups.c.group_id).where(user_groups.c.user_id == user.id))
    group_ids = [row[0] for row in groups_res.all()]
    return UserSchema(
        id=user.id,
        tg_id=user.tg_id,
        username=user.username,
        first_name=user.first_name,
        first_name_real=user.first_name_real,
        last_name_real=user.last_name_real,
        photo_url=user.photo_url,
        email=user.email,
        role=user.role,
        subscription_plan=user.subscription_plan,
        subscription_expires_at=user.subscription_expires_at,
        login=user.login,
        group_ids=group_ids,
        can_edit_real_name=bool(group_ids),
    )


@router.put("/me", response_model=UserSchema)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's personal details (real name)."""
    groups_res = await db.execute(select(user_groups.c.group_id).where(user_groups.c.user_id == user.id))
    group_ids = [row[0] for row in groups_res.all()]

    if body.first_name_real is not None and group_ids:
        user.first_name_real = body.first_name_real
    if body.last_name_real is not None and group_ids:
        user.last_name_real = body.last_name_real
    if body.email is not None:
        email = body.email.strip().lower()
        if email:
            existing = await db.execute(select(User).where(User.email == email, User.id != user.id))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already linked")
            user.email = email
        else:
            user.email = None

    await db.commit()
    await db.refresh(user)
    return await _user_schema(user, db)


@router.post("/change-password")
async def change_password(
    body: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password auth is not enabled")
    if not _verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    user.password_hash = _hash_password(body.new_password)
    user.plain_password = None
    await db.commit()
    return {"ok": True}


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


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def auth_register(body: RegisterAuthData, db: AsyncSession = Depends(get_db)):
    """Register a student with login and password."""
    login = body.login.strip()
    password = body.password
    if len(login) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Логин должен быть не короче 3 символов")
    if len(password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пароль должен быть не короче 6 символов")

    result = await db.execute(select(User).where(User.login == login))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Такой логин уже занят")

    user = User(
        login=login,
        username=login,
        first_name=login,
        password_hash=_hash_password(password),
        role="student",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = _create_jwt(user.id)
    return TokenResponse(access_token=token)
