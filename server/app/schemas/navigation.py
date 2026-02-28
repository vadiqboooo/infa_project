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
    tasks: list[TaskNav] = []

    model_config = {"from_attributes": True}
