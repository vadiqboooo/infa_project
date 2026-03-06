"""Schemas for exams."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.task import AnswerIn


class ExamStartResponse(BaseModel):
    attempt_id: int
    started_at: datetime
    time_limit_minutes: int


class ExamAnswerItem(BaseModel):
    task_id: int
    answer: AnswerIn


class ExamSubmitIn(BaseModel):
    answers: list[ExamAnswerItem]


class TaskResult(BaseModel):
    task_id: int
    ege_number: int | None
    user_answer: AnswerIn | None
    correct_answer: dict | None
    is_correct: bool
    points: int


class ExamResult(BaseModel):
    attempt_id: int
    total_tasks: int
    correct_count: int
    primary_score: int
    score: float
    finished_at: datetime
    task_results: list[TaskResult] = []
