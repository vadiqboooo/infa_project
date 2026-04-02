"""
Одноразовый скрипт: создаёт admin-пользователя с логином и паролем.
Запуск из папки server/:
    python create_admin.py
"""
import asyncio
import sys
import os

# Чтобы работали импорты из app/
sys.path.insert(0, os.path.dirname(__file__))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.user import User

LOGIN = "admin"
PASSWORD = "admin123"   # ← поменяй на любой

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.login == LOGIN))
        user = result.scalar_one_or_none()

        password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()

        if user is None:
            user = User(
                login=LOGIN,
                password_hash=password_hash,
                plain_password=PASSWORD,
                first_name="Admin",
                role="admin",
            )
            session.add(user)
            print(f"✅ Создан новый пользователь: login={LOGIN}")
        else:
            user.password_hash = password_hash
            user.plain_password = PASSWORD
            user.role = "admin"
            print(f"✅ Обновлён существующий пользователь: login={LOGIN}")

        await session.commit()
        print(f"   Логин:  {LOGIN}")
        print(f"   Пароль: {PASSWORD}")
        print("   Войди через форму логин/пароль на странице входа.")

    await engine.dispose()

asyncio.run(main())
