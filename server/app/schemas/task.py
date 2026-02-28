"""Schemas for tasks: reading, syncing, checking answers."""

from __future__ import annotations

from pydantic import BaseModel

from app.models.task import AnswerType


# ── Read ──────────────────────────────────────────────────────

class TaskOut(BaseModel):
    id: int
    topic_id: int
    external_id: str | None = None
    content_html: str
    media_resources: list | dict | None = None
    answer_type: AnswerType

    model_config = {"from_attributes": True}


# ── Sync (Admin / Parser) ────────────────────────────────────

class TaskSyncItem(BaseModel):
    external_id: str
    topic_id: int
    content_html: str
    media_resources: list | dict | None = None
    answer_type: AnswerType = AnswerType.single_number
    correct_answer: dict | None = None


class TaskSyncIn(BaseModel):
    tasks: list[TaskSyncItem]


class TaskSyncResult(BaseModel):
    created: int
    updated: int


# ── Answer checking ───────────────────────────────────────────

class AnswerIn(BaseModel):
    """Universal answer payload.

    Formats (as per TZ):
      single_number → {"val": 3.14}
      pair          → {"val": [1.0, 2.0]}
      table         → {"val": [[1, 2], [3, 4]]}
    """
    val: float | list[float] | list[list[float]]


class CheckResult(BaseModel):
    correct: bool
    attempts_count: int
    status: str  # solved / failed
