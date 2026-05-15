"""Subscription and course access helpers."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.preparation_plan import PreparationPlan
from app.models.task import Task
from app.models.topic import Topic
from app.models.user import User


@dataclass(frozen=True)
class ContentAccess:
    subscription_plan: str
    has_subscription: bool
    trial_task_ids: set[int]


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


async def get_content_access(user: User, db: AsyncSession) -> ContentAccess:
    plan = active_subscription_plan(user)
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
                    .where(Task.ege_number.in_(ege_numbers))
                    .order_by(Topic.order_index, Task.order_index, Task.id)
                    .limit(2)
                )
                trial_task_ids.update(row[0] for row in task_result.all())

    return ContentAccess(
        subscription_plan=plan,
        has_subscription=has_subscription,
        trial_task_ids=trial_task_ids,
    )


def can_access_task(task_id: int, access: ContentAccess) -> bool:
    return access.has_subscription or task_id in access.trial_task_ids


def can_access_topic(topic: Topic, access: ContentAccess) -> bool:
    if access.has_subscription:
        return True
    if topic.category in {"control", "variants", "math", "mock"}:
        return False
    return any(task.id in access.trial_task_ids for task in topic.tasks)


async def require_task_access(task_id: int, user: User, db: AsyncSession) -> ContentAccess:
    access = await get_content_access(user, db)
    if not can_access_task(task_id, access):
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
