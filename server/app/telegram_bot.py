"""Small polling bot that opens the existing Telegram Mini App."""

import asyncio
import logging
import re
import sys
from urllib.parse import urlencode

import httpx

from app.config import settings


LOG = logging.getLogger(__name__)
TOPIC_START = re.compile(r"^topic_[1-9]\d*(?:_[A-Za-z0-9_-]{20,48})?$")
MINI_APP_URL = "https://rancheasy.ru/telegram"
EXPECTED_USERNAME = "easymath26_bot"


def welcome_message(start: str) -> tuple[str, str]:
    if TOPIC_START.fullmatch(start):
        return (
            "Откройте задание и проверьте ответы прямо в Telegram. Прогресс сохранится в вашем профиле.",
            f"{MINI_APP_URL}?{urlencode({'topic': start})}",
        )
    return (
        "Привет! Здесь можно решать задачи по информатике и сразу проверять ответы. Нажмите кнопку, чтобы открыть задания.",
        MINI_APP_URL,
    )


async def telegram_request(client: httpx.AsyncClient, method: str, payload: dict | None = None) -> dict:
    response = await client.post(method, json=payload or {})
    data = response.json()
    if response.status_code != 200 or not data.get("ok"):
        raise RuntimeError(f"Telegram {method} failed with HTTP {response.status_code}")
    return data["result"]


async def handle_update(client: httpx.AsyncClient, update: dict) -> None:
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    if chat.get("type") != "private" or not isinstance(chat.get("id"), int):
        return

    incoming = message.get("text") or ""
    command, _, start = incoming.partition(" ")
    if command.startswith("/start") or command.startswith("/help"):
        text, url = welcome_message(start.strip())
    else:
        text, url = welcome_message("")

    await telegram_request(client, "sendMessage", {
        "chat_id": chat["id"],
        "text": text,
        "reply_markup": {"inline_keyboard": [[{
            "text": "Открыть задания",
            "web_app": {"url": url},
        }]]},
    })


async def run(check_only: bool = False) -> None:
    if not settings.BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is not configured")

    async with httpx.AsyncClient(
        base_url=f"https://api.telegram.org/bot{settings.BOT_TOKEN}/",
        timeout=httpx.Timeout(35.0),
    ) as client:
        bot = await telegram_request(client, "getMe")
        username = (bot.get("username") or "").lower()
        if username != EXPECTED_USERNAME:
            raise RuntimeError(f"Configured bot @{username} is not @{EXPECTED_USERNAME}")

        webhook = await telegram_request(client, "getWebhookInfo")
        if webhook.get("url"):
            raise RuntimeError("A webhook is configured; polling would conflict with it")

        LOG.info("Bot @%s is ready; webhook is empty", username)
        if check_only:
            return

        offset = None
        while True:
            try:
                updates = await telegram_request(client, "getUpdates", {
                    "offset": offset,
                    "timeout": 25,
                    "allowed_updates": ["message"],
                })
                for update in updates:
                    offset = update["update_id"] + 1
                    try:
                        await handle_update(client, update)
                    except Exception as exc:
                        LOG.warning("Could not handle update %s: %s", update.get("update_id"), type(exc).__name__)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOG.warning("Polling failed: %s", type(exc).__name__)
                await asyncio.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        asyncio.run(run(check_only="--check" in sys.argv))
    except Exception as exc:
        LOG.error("Bot startup failed: %s", str(exc))
        raise SystemExit(1) from None
