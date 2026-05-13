from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class PreparationPlanBlockIn(BaseModel):
    title: str
    order_index: int = 0
    ege_numbers: list[int] = Field(default_factory=list)
    task_ids: list[int] = Field(default_factory=list)
    estimated_score: int = 0
    required_solved_count: int = 10
    min_accuracy: int = 70
    requires_control_work: bool = True
    control_topic_id: int | None = None
    includes_variant: bool = False


class PreparationPlanIn(BaseModel):
    title: str
    course_type: str = "year"
    target_score: int = 60
    description: str | None = None
    default_duration_days: int = 14
    final_variants_count: int = 2
    is_active: bool = True
    blocks: list[PreparationPlanBlockIn] = Field(default_factory=list)


class PreparationPlanBlockOut(PreparationPlanBlockIn):
    id: int

    model_config = {"from_attributes": True}


class PreparationPlanOut(BaseModel):
    id: int
    title: str
    course_type: str = "year"
    target_score: int
    description: str | None = None
    default_duration_days: int
    final_variants_count: int
    is_active: bool
    blocks: list[PreparationPlanBlockOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class UserPlanSelectIn(BaseModel):
    plan_id: int
    duration_days: int | None = None


class UserPlanActiveBlockIn(BaseModel):
    block_id: int


class PlanBlockProgressOut(BaseModel):
    block_id: int
    title: str
    ege_numbers: list[int]
    task_ids: list[int] = Field(default_factory=list)
    estimated_score: int = 0
    solved: int
    failed: int
    total_attempted: int
    required_solved_count: int
    accuracy: int
    is_done: bool
    requires_control_work: bool = True
    control_topic_id: int | None = None
    includes_variant: bool = False
    task_progress: list["PlanTaskProgressOut"] = Field(default_factory=list)


class PlanTaskProgressOut(BaseModel):
    task_id: int
    label: str
    ege_number: int | None = None
    ege_number_max: int | None = None
    solved: int
    total: int = 1
    percent: int


class PreparationTaskOptionOut(BaseModel):
    id: int
    topic_id: int
    topic_title: str
    topic_category: str
    order_index: int
    ege_number: int | None = None
    ege_number_max: int | None = None
    title: str | None = None
    label: str


class CurrentPlanRecommendationOut(BaseModel):
    user_plan_id: int | None = None
    active_block_id: int | None = None
    plan: PreparationPlanOut | None = None
    started_at: date | None = None
    target_date: date | None = None
    days_left: int = 0
    total_required: int = 0
    total_solved: int = 0
    progress_percent: int = 0
    current_block: PlanBlockProgressOut | None = None
    block_progress: list[PlanBlockProgressOut] = Field(default_factory=list)
    today_ege_numbers: list[int] = Field(default_factory=list)
    daily_task_target: int = 0
    next_action: str | None = None
    next_control_in_days: int | None = None
    final_variants_left: int = 0
    subscription_plan: str = "none"
    subscription_required: bool = False
