"""Тест подключения к LLM API."""

import asyncio
import httpx
from app.config import settings


async def test_llm():
    """Простой тест запроса к LLM API."""
    print(f"Тестирование LLM API...")
    print(f"URL: {settings.LLM_BASE_URL}/chat/completions")
    print(f"Модель: {settings.LLM_MODEL}")
    print(f"API ключ установлен: {bool(settings.LLM_API_KEY)}")
    print()

    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Edu Platform Test",
    }

    payload = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "user", "content": "Скажи привет на русском языке"}
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            print("Отправка запроса...")
            resp = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

            print(f"Статус: {resp.status_code}")

            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                print(f"[OK] Uspeh! Otvet: {content}")
            else:
                print(f"[ERROR] Oshibka {resp.status_code}")
                print(f"Otvet: {resp.text}")

    except Exception as e:
        print(f"[ERROR] Oshibka: {e}")


if __name__ == "__main__":
    asyncio.run(test_llm())
