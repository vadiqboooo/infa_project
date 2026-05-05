"""Schemas for admin panel: topics and tasks CRUD."""

from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from app.models.task import AnswerType, TaskDifficulty


# ── Topics ────────────────────────────────────────────────────

class TopicIn(BaseModel):
    title: str
    order_index: int = 0
    category: str = "tutorial"
    time_limit_minutes: int | None = 60
    is_mock: bool = False
    ege_number: int | None = None
    ege_number_end: int | None = None
    image_position: str | None = None  # 'cover' | 'left' | 'right' | 'background'
    image_size: int | None = None
    character_url: str | None = None
    background_url: str | None = None


class TopicOut(BaseModel):
    id: int
    title: str
    order_index: int
    category: str = "tutorial"
    task_count: int = 0
    time_limit_minutes: int | None = 60
    is_mock: bool = False
    ege_number: int | None = None
    ege_number_end: int | None = None
    has_image: bool = False
    image_position: str | None = None
    image_size: int | None = None
    character_url: str | None = None
    background_url: str | None = None

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
    order_index: int | None = None
    sub_tasks: list | None = None


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
    content_html: str | None = None
    answer_type: AnswerType = AnswerType.single_number
    difficulty: TaskDifficulty = TaskDifficulty.easy
    correct_answer: Any = None
    solution_steps: list | None = None
    full_solution_code: str | None = None
    order_index: int = 0
    sub_tasks: list | None = None

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
    login: str | None = None
    last_active_at: datetime
    total_solved: int
    total_tasks: int
    exam_scores: list[StudentExamScore]
    topic_progress: list[StudentTopicProgress]
    group_ids: list[int] = []


class UserRoleUpdate(BaseModel):
    role: str


# ── Student detail (per-task breakdown) ───────────────

class StudentTaskResult(BaseModel):
    task_id: int
    ege_number: int | None
    order_index: int
    status: str  # "solved" | "failed" | "not_started"
    attempts_count: int
    has_own_solution: bool = False
    solution_comments_count: int = 0


class TaskSolutionCommentIn(BaseModel):
    from_offset: int | None = Field(default=None, ge=0)
    to_offset: int | None = Field(default=None, ge=0)
    from_line: int = Field(ge=1)
    from_col: int = Field(ge=1)
    to_line: int = Field(ge=1)
    to_col: int = Field(ge=1)
    text: str = Field(min_length=1)


class TaskSolutionCommentOut(BaseModel):
    id: int
    from_offset: int | None = None
    to_offset: int | None = None
    from_line: int
    from_col: int
    to_line: int
    to_col: int
    text: str
    author_name: str | None = None
    reaction: str | None = None
    created_at: datetime
    updated_at: datetime


class StudentTaskSolutionReviewOut(BaseModel):
    student_id: int
    task_id: int
    task_title: str | None = None
    ege_number: int | None = None
    code: str | None = None
    file_url: str | None = None
    image_url: str | None = None
    updated_at: datetime | None = None
    comments: list[TaskSolutionCommentOut] = Field(default_factory=list)


class StudentTopicDetail(BaseModel):
    topic_id: int
    topic_name: str
    category: str
    attempt_id: int | None = None  # latest finished exam attempt (for AI analysis)
    has_analysis: bool = False     # whether analysis is already saved in DB
    tasks: list[StudentTaskResult]


class StudentWeeklyEgeStat(BaseModel):
    ege_number: int | None
    total: int
    correct: int
    incorrect: int
    accuracy: int


class StudentWeeklyStats(BaseModel):
    total: int = 0
    correct: int = 0
    incorrect: int = 0
    ege_numbers: list[StudentWeeklyEgeStat] = Field(default_factory=list)


class StudentDetailOut(BaseModel):
    id: int
    name: str
    username: str | None
    photo_url: str | None
    role: str
    last_active_at: datetime
    total_solved: int
    total_tasks: int
    weekly_stats: StudentWeeklyStats = Field(default_factory=StudentWeeklyStats)
    topics: list[StudentTopicDetail]


# ── Topic stats matrix ─────────────────────────────────

class TopicStatsStudentRow(BaseModel):
    student_id: int
    student_name: str
    photo_url: str | None
    attempt_id: int | None  # latest finished exam attempt id (for AI analysis)
    group_ids: list[int] = []
    results: dict[int, str]  # task_id -> "solved"|"failed"|"not_started"
    answers: dict[int, Any] = {}  # task_id -> {user_answer, code_solution, file_solution_url, is_correct, points, max_points}
    exam_started_at: datetime | None = None
    exam_finished_at: datetime | None = None
    exam_duration_minutes: int | None = None  # actual time spent


class TopicStatsTaskInfo(BaseModel):
    task_id: int
    ege_number: int | None
    order_index: int
    correct_answer: Any | None = None  # {"val": ...} or None


class TopicStatsOut(BaseModel):
    topic_id: int
    topic_title: str
    tasks: list[TopicStatsTaskInfo]
    students: list[TopicStatsStudentRow]


# ── Groups ────────────────────────────────────────────────────

class GroupIn(BaseModel):
    name: str
    color: str = "#3F8C62"


class GroupOut(BaseModel):
    id: int
    name: str
    color: str
    student_count: int = 0

    model_config = {"from_attributes": True}


# ── Password-based student creation ───────────────────────────

class PasswordStudentCreate(BaseModel):
    first_name: str
    last_name: str
    login: str | None = None  # auto-generated if omitted


class SetStudentCredentials(BaseModel):
    login: str


class PasswordStudentCredential(BaseModel):
    id: int
    name: str
    login: str
    plain_password: str
    group_ids: list[int] = []
