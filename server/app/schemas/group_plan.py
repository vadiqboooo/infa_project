from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GroupLessonItemIn(BaseModel):
    section: Literal["theory", "testing", "lesson", "homework"]
    topic_id: int | None = None
    task_id: int | None = None
    article_id: int | None = None
    article_mode: Literal["reading", "quiz"] = "reading"
    order_index: int = 0

    @model_validator(mode="after")
    def validate_resource(self):
        if sum(value is not None for value in (self.topic_id, self.task_id, self.article_id)) != 1:
            raise ValueError("Choose exactly one topic, task or article")
        if self.article_mode == "quiz" and self.article_id is None:
            raise ValueError("Для тестирования выберите статью с тестом")
        if self.section == "theory" and (self.article_id is None or self.article_mode != "reading"):
            raise ValueError("В теорию можно добавить только статью")
        if self.section == "testing" and (self.article_id is None or self.article_mode != "quiz"):
            raise ValueError("В тестирование по теории можно добавить только тест")
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
    topic_category: str | None = None
    topic_id: int | None = None
    task_id: int | None = None
    article_id: int | None = None
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


class GroupPlanArticleOptionOut(BaseModel):
    id: int
    title: str
    published: bool
    question_count: int = 0


class GroupPlanResourcesOut(BaseModel):
    topics: list[GroupPlanTopicOptionOut] = Field(default_factory=list)
    articles: list[GroupPlanArticleOptionOut] = Field(default_factory=list)


class LessonStudentOut(BaseModel):
    id: int
    name: str
    last_active_at: datetime


class LessonItemStudentProgress(BaseModel):
    user_id: int
    solved: int = 0
    total: int = 0
    completion_status: str = "not_started"


class LessonItemProgressOut(GroupLessonItemOut):
    progress: list[LessonItemStudentProgress] = Field(default_factory=list)


class LessonProgressLessonOut(BaseModel):
    id: int
    title: str
    lesson_at: datetime
    homework_deadline: datetime | None = None
    status: str
    items: list[LessonItemProgressOut] = Field(default_factory=list)


class GroupLessonProgressOut(BaseModel):
    group_id: int
    group_name: str
    group_color: str
    students: list[LessonStudentOut] = Field(default_factory=list)
    lessons: list[LessonProgressLessonOut] = Field(default_factory=list)


class TaskResultCell(BaseModel):
    state: Literal["none", "ok", "bad"] = "none"
    answer: str = ""


class TaskResultTask(BaseModel):
    task_id: int
    number: int
    correct: str = ""


class TaskResultRow(BaseModel):
    user_id: int
    cells: list[TaskResultCell] = Field(default_factory=list)


class TaskResultStep(BaseModel):
    item_id: int
    title: str
    section: str
    topic_category: str | None = None
    tasks: list[TaskResultTask] = Field(default_factory=list)
    rows: list[TaskResultRow] = Field(default_factory=list)


class LessonTaskResultsOut(BaseModel):
    lesson_id: int
    steps: list[TaskResultStep] = Field(default_factory=list)

