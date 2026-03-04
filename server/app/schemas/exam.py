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


class ExamResult(BaseModel):
    attempt_id: int
    total_tasks: int
    correct_count: int
    primary_score: int
    score: float
    finished_at: datetime
