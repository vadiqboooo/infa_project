"""Schemas for tasks: reading, syncing, checking answers."""

from __future__ import annotations

from pydantic import BaseModel, field_validator

from app.models.task import AnswerType


# ── Read ──────────────────────────────────────────────────────

class TaskOut(BaseModel):
    id: int
    topic_id: int
    external_id: str | None = None
    ege_number: int | None = None
    title: str | None = None
    description: str | None = None
    content_html: str
    media_resources: list | dict | None = None
    answer_type: AnswerType
    difficulty: str = "easy"
    solution_steps: list | None = None
    full_solution_code: str | None = None

    model_config = {"from_attributes": True}


# ── Sync (Admin / Parser) ────────────────────────────────────

class TaskSyncItem(BaseModel):
    external_id: str
    topic_id: int
    content_html: str
    media_resources: list | dict | None = None
    answer_type: AnswerType = AnswerType.single_number
    correct_answer: dict | None = None
    solution_steps: list | None = None
    full_solution_code: str | None = None


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
      text          → {"val": "xwyz"}
    """
    val: float | list[float] | list[list[float | str]] | str

    @field_validator("val", mode="after")
    @classmethod
    def strip_empty_table_rows(cls, v):
        """Remove rows where all cells are empty strings from table answers."""
        if isinstance(v, list) and v and isinstance(v[0], list):
            v = [row for row in v if any(cell != "" for cell in row)]
        return v


class CheckResult(BaseModel):
    correct: bool
    attempts_count: int
    status: str  # solved / failed
