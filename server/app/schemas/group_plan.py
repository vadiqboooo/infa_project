from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GroupLessonItemIn(BaseModel):
    section: Literal["lesson", "homework"]
    topic_id: int | None = None
    task_id: int | None = None
    order_index: int = 0

    @model_validator(mode="after")
    def validate_resource(self):
        if (self.topic_id is None) == (self.task_id is None):
            raise ValueError("Choose exactly one topic or task")
        return self


class GroupLessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    lesson_at: datetime
    homework_deadline: datetime | None = None
    note: str | None = None
    status: Literal["draft", "published", "completed"] = "draft"
    items: list[GroupLessonItemIn] = Field(default_factory=list)


class GroupLessonItemOut(BaseModel):
    id: int
    section: str
    resource_type: str
    topic_id: int | None = None
    task_id: int | None = None
    title: str
    subtitle: str | None = None
    href: str
    solved: int = 0
    total: int = 0
    progress_percent: int = 0
    completion_status: str = "not_started"


class GroupLessonOut(BaseModel):
    id: int
    group_id: int
    student_id: int | None = None
    group_name: str
    group_color: str
    title: str
    lesson_at: datetime
    homework_deadline: datetime | None = None
    note: str | None = None
    status: str
    items: list[GroupLessonItemOut] = Field(default_factory=list)


class GroupPlanTaskOptionOut(BaseModel):
    id: int
    title: str
    ege_number: int | None = None
    order_index: int


class GroupPlanTopicOptionOut(BaseModel):
    id: int
    title: str
    category: str
    subject: str
    tasks: list[GroupPlanTaskOptionOut] = Field(default_factory=list)


class GroupPlanResourcesOut(BaseModel):
    topics: list[GroupPlanTopicOptionOut] = Field(default_factory=list)
