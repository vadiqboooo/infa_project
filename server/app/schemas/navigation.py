"""Schemas for sidebar navigation tree."""

from pydantic import BaseModel


class TaskNav(BaseModel):
    id: int
    external_id: str | None = None
    status: str = "not_started"  # not_started / solved / failed

    model_config = {"from_attributes": True}


class TopicNav(BaseModel):
    id: int
    title: str
    order_index: int
    category: str = "tutorial"
    tasks: list[TaskNav] = []
    exam_id: int | None = None
    latest_score: float | None = None
    max_score: int | None = None

    model_config = {"from_attributes": True}
