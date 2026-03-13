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


class CodeSolutionItem(BaseModel):
    task_id: int
    code: str


class TaskTimingItem(BaseModel):
    task_id: int
    opened_at_ms: int        # Unix ms when task was first opened
    answered_at_ms: int | None = None  # Unix ms when answer was last saved


class ExamSubmitIn(BaseModel):
    answers: list[ExamAnswerItem]
    code_solutions: list[CodeSolutionItem] = []
    task_timings: list[TaskTimingItem] = []


class TaskResult(BaseModel):
    task_id: int
    ege_number: int | None
    user_answer: AnswerIn | None
    correct_answer: dict | None
    is_correct: bool
    points: int
    max_points: int = 1
    auto_checked: bool = True
    code_solution: str | None = None
    file_solution_url: str | None = None


class ExamResult(BaseModel):
    attempt_id: int
    total_tasks: int
    correct_count: int
    primary_score: int
    score: float
    finished_at: datetime
    task_results: list[TaskResult] = []
