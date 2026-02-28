"""Schemas for admin panel: topics and tasks CRUD."""

from __future__ import annotations

from pydantic import BaseModel

from app.models.task import AnswerType


# ── Topics ────────────────────────────────────────────────────

class TopicIn(BaseModel):
    title: str
    order_index: int = 0


class TopicOut(BaseModel):
    id: int
    title: str
    order_index: int
    task_count: int = 0

    model_config = {"from_attributes": True}


# ── Tasks ─────────────────────────────────────────────────────

class TaskAdminIn(BaseModel):
    topic_id: int
    external_id: str | None = None
    content_html: str = ""
    media_resources: dict | list | None = None
    answer_type: AnswerType = AnswerType.single_number
    correct_answer: dict | None = None


class ImportVariantIn(BaseModel):
    variant_id: int
    topic_title: str | None = None  # если None — используем "Вариант {variant_id}"


class ImportVariantResult(BaseModel):
    topic_id: int
    topic_title: str
    created_count: int
    skipped_count: int  # задачи без ответа / непарсируемые


class TaskAdminOut(BaseModel):
    id: int
    topic_id: int
    external_id: str | None = None
    content_html: str
    answer_type: AnswerType
    correct_answer: dict | None = None

    model_config = {"from_attributes": True}
