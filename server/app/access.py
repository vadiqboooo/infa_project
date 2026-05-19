"""Subscription and course access helpers."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.preparation_plan import PreparationPlan, UserPreparationPlan
from app.models.task import Task
from app.models.topic import Topic
from app.models.user import User


@dataclass(frozen=True)
class ContentAccess:
    subscription_plan: str
    course_type: str
    has_subscription: bool
    trial_task_ids: set[int]
    can_access_all: bool = False


COMMON_TOPIC_COURSE_TYPES = {"common", "all"}


def active_subscription_plan(user: User) -> str:
    if user.role == "admin":
        return "year"
    plan = user.subscription_plan or "none"
    if plan not in {"summer", "year"}:
        return "none"
    expires_at = user.subscription_expires_at
    if expires_at is not None:
        now = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            return "none"
    return plan


async def active_content_course_type(user: User, db: AsyncSession, subscription_plan: str) -> str:
    result = await db.execute(
        select(PreparationPlan.course_type)
        .join(UserPreparationPlan, UserPreparationPlan.plan_id == PreparationPlan.id)
        .where(
            UserPreparationPlan.user_id == user.id,
            UserPreparationPlan.status == "active",
        )
        .order_by(UserPreparationPlan.id.desc())
        .limit(1)
    )
    selected_course = result.scalar_one_or_none()
    if selected_course in {"year", "summer"}:
        return selected_course
    if subscription_plan in {"year", "summer"}:
        return subscription_plan
    return "summer"


async def get_content_access(user: User, db: AsyncSession) -> ContentAccess:
    plan = active_subscription_plan(user)
    course_type = await active_content_course_type(user, db, plan)
    has_subscription = plan in {"summer", "year"}
    trial_task_ids: set[int] = set()

    if not has_subscription:
        summer_result = await db.execute(
            select(PreparationPlan)
            .options(selectinload(PreparationPlan.blocks))
            .where(
                PreparationPlan.is_active.is_(True),
                PreparationPlan.course_type == "summer",
            )
            .order_by(PreparationPlan.target_score, PreparationPlan.id)
        )
        summer_plan = summer_result.scalars().unique().first()
        if summer_plan:
            ordered_task_ids: list[int] = []
            ege_numbers: list[int] = []
            for block in sorted(summer_plan.blocks, key=lambda item: item.order_index):
                ordered_task_ids.extend(block.task_ids or [])
                ege_numbers.extend(block.ege_numbers or [])

            if ordered_task_ids:
                trial_task_ids.update(ordered_task_ids[:2])
            if len(trial_task_ids) < 2 and ege_numbers:
                task_result = await db.execute(
                    select(Task.id)
                    .join(Topic, Topic.id == Task.topic_id)
                    .where(Task.ege_number.in_(ege_numbers), Topic.course_type == "summer")
                    .order_by(Topic.order_index, Task.order_index, Task.id)
                    .limit(2)
                )
                trial_task_ids.update(row[0] for row in task_result.all())

    return ContentAccess(
        subscription_plan=plan,
        course_type=course_type,
        has_subscription=has_subscription,
        trial_task_ids=trial_task_ids,
        can_access_all=user.role == "admin" and course_type not in {"year", "summer"},
    )


def can_access_task(task_id: int, access: ContentAccess) -> bool:
    return access.has_subscription or task_id in access.trial_task_ids


def can_access_topic_course(topic: Topic, access: ContentAccess) -> bool:
    if access.can_access_all:
        return True
    course_type = getattr(topic, "course_type", None) or "year"
    return course_type in COMMON_TOPIC_COURSE_TYPES or course_type == access.course_type


def can_access_topic(topic: Topic, access: ContentAccess) -> bool:
    if not can_access_topic_course(topic, access):
        return False
    if access.has_subscription:
        return True
    if topic.category in {"control", "variants", "math", "mock"}:
        return False
    return any(task.id in access.trial_task_ids for task in topic.tasks)


async def require_task_access(task_id: int, user: User, db: AsyncSession) -> ContentAccess:
    access = await get_content_access(user, db)
    task_result = await db.execute(
        select(Task)
        .options(selectinload(Task.topic))
        .where(Task.id == task_id)
    )
    task = task_result.scalar_one_or_none()
    if task is None or not can_access_topic_course(task.topic, access) or not can_access_task(task_id, access):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription required",
        )
    return access


async def require_exam_access(user: User, db: AsyncSession) -> ContentAccess:
    access = await get_content_access(user, db)
    if not access.has_subscription:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription required",
        )
    return access


async def require_exam_topic_access(topic: Topic, user: User, db: AsyncSession) -> ContentAccess:
    access = await require_exam_access(user, db)
    if not can_access_topic_course(topic, access):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription required",
        )
    return access
