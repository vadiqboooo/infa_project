import hashlib
import hmac
import json
from datetime import datetime, timezone
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException

from app.config import settings
from app.routers.auth import _verified_mini_app_user


def signed_data(user: dict, auth_date: int, token: str = "test-bot-token") -> str:
    fields = {"auth_date": str(auth_date), "user": json.dumps(user, separators=(",", ":"))}
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def test_valid_mini_app_signature(monkeypatch):
    monkeypatch.setattr(settings, "BOT_TOKEN", "test-bot-token")
    data = signed_data({"id": 123456789, "first_name": "Ученик"}, int(datetime.now(timezone.utc).timestamp()))
    assert _verified_mini_app_user(data)["id"] == 123456789


def test_tampered_mini_app_user_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "BOT_TOKEN", "test-bot-token")
    data = signed_data({"id": 123}, int(datetime.now(timezone.utc).timestamp()))
    with pytest.raises(HTTPException) as error:
        _verified_mini_app_user(data.replace("123", "124"))
    assert error.value.status_code == 401


def test_expired_mini_app_data_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "BOT_TOKEN", "test-bot-token")
    data = signed_data({"id": 123}, int(datetime.now(timezone.utc).timestamp()) - 7200)
    with pytest.raises(HTTPException) as error:
        _verified_mini_app_user(data)
    assert error.value.status_code == 401
