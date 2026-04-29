"""Schemas for sidebar navigation tree."""

from pydantic import BaseModel


class TaskNav(BaseModel):
    id: int
    external_id: str | None = None
    ege_number: int | None = None
    ege_number_max: int | None = None  # max sub-task number when composite (e.g. 21 for 19-21)
    status: str = "not_started"  # not_started / solved / failed
    has_solution: bool = False

    model_config = {"from_attributes": True}


class TopicNav(BaseModel):
    id: int
    title: str
    order_index: int
    category: str = "tutorial"
    tasks: list[TaskNav] = []
    exam_id: int | None = None
    latest_score: float | None = None
    latest_primary_score: int | None = None
    max_score: int | None = None
    time_limit_minutes: int | None = None
    is_mock: bool = False
    ege_number: int | None = None
    ege_number_end: int | None = None
    analysis_published: bool = False
    draft_count: int = 0

    model_config = {"from_attributes": True}
