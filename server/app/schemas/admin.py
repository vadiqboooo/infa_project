"""Schemas for admin panel: topics and tasks CRUD."""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel
from app.models.task import AnswerType, TaskDifficulty


# ── Topics ────────────────────────────────────────────────────

class TopicIn(BaseModel):
    title: str
    order_index: int = 0
    category: str = "tutorial"


class TopicOut(BaseModel):
    id: int
    title: str
    order_index: int
    category: str = "tutorial"
    task_count: int = 0

    model_config = {"from_attributes": True}


# ── Tasks ─────────────────────────────────────────────────────

class TaskAdminIn(BaseModel):
    topic_id: int
    external_id: str | None = None
    ege_number: int | None = None
    title: str | None = None
    description: str | None = None
    content_html: str = ""
    media_resources: dict | list | None = None
    answer_type: AnswerType = AnswerType.single_number
    difficulty: TaskDifficulty = TaskDifficulty.easy
    correct_answer: dict | None = None
    solution_steps: list | None = None
    full_solution_code: str | None = None


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
    ege_number: int | None = None
    title: str | None = None
    description: str | None = None
    content_html: str
    answer_type: AnswerType
    difficulty: TaskDifficulty = TaskDifficulty.easy
    correct_answer: dict | None = None
    solution_steps: list | None = None
    full_solution_code: str | None = None

    model_config = {"from_attributes": True}


# ── Students ──────────────────────────────────────────────────

class StudentTopicProgress(BaseModel):
    topic_name: str
    solved: int
    total: int


class StudentExamScore(BaseModel):
    variant_name: str
    score: float
    max_score: int


class StudentOut(BaseModel):
    id: int
    name: str
    username: str | None
    photo_url: str | None
    role: str
    last_active_at: datetime
    total_solved: int
    total_tasks: int
    exam_scores: list[StudentExamScore]
    topic_progress: list[StudentTopicProgress]


class UserRoleUpdate(BaseModel):
    role: str
