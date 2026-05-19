"""Preparation plan routes for admins and students."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.access import active_subscription_plan
from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.preparation_plan import PreparationPlan, PreparationPlanBlock, UserPreparationPlan
from app.models.progress import ProgressStatus, UserProgress
from app.models.task import Task
from app.models.topic import Topic
from app.models.user import User
from app.schemas.preparation_plan import (
    CurrentPlanRecommendationOut,
    PlanBlockProgressOut,
    PlanTaskProgressOut,
    PreparationPlanBlockOut,
    PreparationPlanIn,
    PreparationPlanOut,
    PreparationTaskOptionOut,
    UserPlanActiveBlockIn,
    UserPlanSelectIn,
)

router = APIRouter(tags=["preparation"])


def _plan_out(plan: PreparationPlan) -> PreparationPlanOut:
    course_type = getattr(plan, "course_type", None) or "year"
    return PreparationPlanOut(
        id=plan.id,
        title=plan.title,
        course_type=course_type,
        target_score=plan.target_score,
        description=plan.description,
        default_duration_days=plan.default_duration_days,
        final_variants_count=plan.final_variants_count,
        is_active=plan.is_active,
        blocks=[
            PreparationPlanBlockOut(
                id=block.id,
                title=block.title,
                order_index=block.order_index,
                ege_numbers=block.ege_numbers or [],
                task_ids=block.task_ids or [],
                estimated_score=block.estimated_score,
                required_solved_count=block.required_solved_count,
                min_accuracy=block.min_accuracy,
                requires_control_work=block.requires_control_work,
                control_topic_id=block.control_topic_id,
                includes_variant=block.includes_variant,
            )
            for block in sorted(plan.blocks, key=lambda item: item.order_index)
        ],
    )


def _compute_ege_max(task: Task) -> int | None:
    if not task.sub_tasks:
        return None
    nums: list[int] = []
    if isinstance(task.ege_number, int):
        nums.append(task.ege_number)
    for sub_task in task.sub_tasks:
        if isinstance(sub_task, dict) and isinstance(sub_task.get("number"), int):
            nums.append(sub_task["number"])
    return max(nums) if len(nums) >= 2 else None


def _task_label(task: Task) -> str:
    ege_number = task.ege_number
    ege_number_max = _compute_ege_max(task)
    if ege_number is not None and ege_number_max and ege_number_max > ege_number:
        return f"№{ege_number}-{ege_number_max}"
    if ege_number is not None:
        return f"№{ege_number}"
    if task.title:
        return task.title
    return f"Задача {task.id}"


def _format_plan_ege_numbers(numbers: list[int]) -> str:
    number_set = set(numbers)
    labels: list[str] = []
    for number in range(1, 19):
        if number in number_set:
            labels.append(str(number))
            number_set.remove(number)
    if {19, 20, 21}.issubset(number_set):
        labels.append("19-21")
        number_set.difference_update({19, 20, 21})
    for number in range(22, 28):
        if number in number_set:
            labels.append(str(number))
            number_set.remove(number)
    labels.extend(str(number) for number in sorted(number_set))
    return ", ".join(labels)


async def _get_plan_or_404(plan_id: int, db: AsyncSession) -> PreparationPlan:
    result = await db.execute(
        select(PreparationPlan)
        .options(selectinload(PreparationPlan.blocks))
        .where(PreparationPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


async def _calculate_current_plan(
    user_plan: UserPreparationPlan | None,
    user: User,
    db: AsyncSession,
) -> CurrentPlanRecommendationOut:
    if not user_plan:
        subscription_plan = active_subscription_plan(user)
        if subscription_plan == "none":
            return CurrentPlanRecommendationOut(
                subscription_plan=subscription_plan,
                subscription_required=True,
                next_action="Оформите подписку на летний курс или годовую подготовку, чтобы открыть полный доступ.",
            )
        result = await db.execute(
            select(PreparationPlan)
            .options(selectinload(PreparationPlan.blocks))
            .where(
                PreparationPlan.is_active.is_(True),
                PreparationPlan.course_type == subscription_plan,
            )
            .order_by(PreparationPlan.target_score, PreparationPlan.id)
        )
        plan = result.scalars().unique().first()
        if not plan and subscription_plan == "year":
            result = await db.execute(
                select(PreparationPlan)
                .options(selectinload(PreparationPlan.blocks))
                .where(PreparationPlan.is_active.is_(True))
                .order_by(PreparationPlan.target_score, PreparationPlan.id)
            )
            plan = result.scalars().unique().first()
        if not plan:
            return CurrentPlanRecommendationOut(
                subscription_plan=subscription_plan,
                next_action="Администратор пока не настроил план подготовки для этой подписки.",
            )
        today = date.today()
        started_at = today
        target_date = today + timedelta(days=max(plan.default_duration_days, 1) - 1)
    else:
        plan = await _get_plan_or_404(user_plan.plan_id, db)
        started_at = user_plan.started_at
        target_date = user_plan.target_date

    all_ege_numbers = sorted({num for block in plan.blocks for num in (block.ege_numbers or [])})
    all_task_ids = sorted({task_id for block in plan.blocks for task_id in (block.task_ids or [])})

    task_by_id: dict[int, Task] = {}
    if all_task_ids:
        task_result = await db.execute(select(Task).where(Task.id.in_(all_task_ids)))
        task_by_id = {task.id: task for task in task_result.scalars().all()}

    task_progress_rows = []
    ege_progress_rows = []
    if all_task_ids:
        progress_result = await db.execute(
            select(UserProgress, Task.id)
            .join(Task, Task.id == UserProgress.task_id)
            .where(UserProgress.user_id == user.id, Task.id.in_(all_task_ids))
        )
        task_progress_rows = progress_result.all()
    if all_ege_numbers:
        progress_result = await db.execute(
            select(UserProgress, Task.ege_number)
            .join(Task, Task.id == UserProgress.task_id)
            .join(Topic, Topic.id == Task.topic_id)
            .where(
                UserProgress.user_id == user.id,
                Task.ege_number.in_(all_ege_numbers),
                Topic.course_type.in_([plan.course_type, "common", "all"]),
            )
        )
        ege_progress_rows = progress_result.all()

    progress_by_ege: dict[int, dict[str, int]] = {}
    progress_by_task: dict[int, ProgressStatus] = {}
    for progress, key in task_progress_rows:
        if key is None:
            continue
        progress_by_task[key] = progress.status
    for progress, key in ege_progress_rows:
        if key is None:
            continue
        bucket = progress_by_ege.setdefault(key, {"solved": 0, "failed": 0})
        if progress.status == ProgressStatus.solved:
            bucket["solved"] += 1
        elif progress.status == ProgressStatus.failed:
            bucket["failed"] += 1

    block_progress: list[PlanBlockProgressOut] = []
    for block in sorted(plan.blocks, key=lambda item: item.order_index):
        task_progress: list[PlanTaskProgressOut] = []
        if block.task_ids:
            for task_id in block.task_ids:
                task = task_by_id.get(task_id)
                status_value = progress_by_task.get(task_id)
                solved_item = 1 if status_value == ProgressStatus.solved else 0
                task_progress.append(
                    PlanTaskProgressOut(
                        task_id=task_id,
                        label=_task_label(task) if task else f"Задача {task_id}",
                        ege_number=task.ege_number if task else None,
                        ege_number_max=_compute_ege_max(task) if task else None,
                        solved=solved_item,
                        total=1,
                        percent=100 if solved_item else 0,
                    )
                )
            solved = sum(item.solved for item in task_progress)
            failed = sum(
                1
                for task_id in block.task_ids
                if progress_by_task.get(task_id) == ProgressStatus.failed
            )
        else:
            solved = sum(progress_by_ege.get(num, {}).get("solved", 0) for num in (block.ege_numbers or []))
            failed = sum(progress_by_ege.get(num, {}).get("failed", 0) for num in (block.ege_numbers or []))
        attempted = solved + failed
        accuracy = round(solved / attempted * 100) if attempted else 0
        is_done = solved >= block.required_solved_count and accuracy >= block.min_accuracy
        block_progress.append(
            PlanBlockProgressOut(
                block_id=block.id,
                title=block.title,
                ege_numbers=block.ege_numbers or [],
                task_ids=block.task_ids or [],
                estimated_score=block.estimated_score,
                solved=solved,
                failed=failed,
                total_attempted=attempted,
                required_solved_count=block.required_solved_count,
                accuracy=accuracy,
                is_done=is_done,
                requires_control_work=block.requires_control_work,
                control_topic_id=block.control_topic_id,
                includes_variant=block.includes_variant,
                task_progress=task_progress,
            )
        )

    total_required = sum(item.required_solved_count for item in block_progress)
    total_solved = sum(min(item.solved, item.required_solved_count) for item in block_progress)
    progress_percent = round(total_solved / total_required * 100) if total_required else 0
    current_block = next((item for item in block_progress if not item.is_done), None)

    today = date.today()
    days_left = max((target_date - today).days + 1, 1)
    remaining_required = max(total_required - total_solved, 0)
    daily_target = max(1, (remaining_required + days_left - 1) // days_left) if remaining_required else 0
    completed_blocks = sum(1 for item in block_progress if item.is_done)
    next_control_in_days = None
    if current_block:
        missing_in_block = max(current_block.required_solved_count - current_block.solved, 0)
        next_control_in_days = max(1, (missing_in_block + daily_target - 1) // max(daily_target, 1))

    final_variants_left = plan.final_variants_count if progress_percent >= 100 else 0
    if current_block:
        labels = ", ".join(item.label for item in current_block.task_progress) or _format_plan_ege_numbers(current_block.ege_numbers)
        next_action = f"Сегодня решите {daily_target} задач(и) из блока «{current_block.title}»: {labels}."
        if current_block.control_topic_id and next_control_in_days and next_control_in_days <= 1:
            next_action += " После закрытия блока переходите к контрольной."
    elif final_variants_left:
        next_action = f"Основные блоки закрыты. Переходите к {final_variants_left} полноценным вариантам."
    else:
        next_action = "План закрыт. Поддерживайте форму вариантами и повторением слабых мест."

    return CurrentPlanRecommendationOut(
        user_plan_id=user_plan.id if user_plan else None,
        active_block_id=user_plan.active_block_id if user_plan else None,
        plan=_plan_out(plan),
        started_at=started_at,
        target_date=target_date,
        days_left=days_left,
        total_required=total_required,
        total_solved=total_solved,
        progress_percent=progress_percent,
        current_block=current_block,
        block_progress=block_progress,
        today_ege_numbers=current_block.ege_numbers if current_block else [],
        daily_task_target=daily_target,
        next_action=next_action,
        next_control_in_days=next_control_in_days if current_block and completed_blocks < len(block_progress) else None,
        final_variants_left=final_variants_left,
        subscription_plan=active_subscription_plan(user),
        subscription_required=False,
    )


@router.get("/preparation-plans", response_model=list[PreparationPlanOut])
async def list_public_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PreparationPlan)
        .options(selectinload(PreparationPlan.blocks))
        .where(PreparationPlan.is_active.is_(True))
        .order_by(PreparationPlan.target_score, PreparationPlan.id)
    )
    return [_plan_out(plan) for plan in result.scalars().unique().all()]


@router.get("/preparation-plans/current", response_model=CurrentPlanRecommendationOut)
async def get_current_preparation_plan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreparationPlan)
        .where(UserPreparationPlan.user_id == user.id, UserPreparationPlan.status == "active")
        .order_by(UserPreparationPlan.id.desc())
    )
    user_plan = result.scalars().first()
    return await _calculate_current_plan(user_plan, user, db)


@router.post("/preparation-plans/select", response_model=CurrentPlanRecommendationOut)
async def select_preparation_plan(
    body: UserPlanSelectIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(body.plan_id, db)
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Plan is inactive")
    subscription_plan = active_subscription_plan(user)
    if subscription_plan == "none" and plan.course_type != "summer":
        raise HTTPException(status_code=403, detail="Subscription required")
    if subscription_plan != "year" and plan.course_type != subscription_plan:
        if not (subscription_plan == "none" and plan.course_type == "summer"):
            raise HTTPException(status_code=403, detail="Plan is not available for this subscription")

    await db.execute(
        UserPreparationPlan.__table__.update()
        .where(UserPreparationPlan.user_id == user.id, UserPreparationPlan.status == "active")
        .values(status="archived")
    )
    duration = body.duration_days or plan.default_duration_days
    today = date.today()
    user_plan = UserPreparationPlan(
        user_id=user.id,
        plan_id=plan.id,
        active_block_id=next((block.id for block in sorted(plan.blocks, key=lambda item: item.order_index)), None),
        started_at=today,
        target_date=today + timedelta(days=max(duration, 1) - 1),
        status="active",
    )
    db.add(user_plan)
    await db.commit()
    await db.refresh(user_plan)
    return await _calculate_current_plan(user_plan, user, db)


@router.put("/preparation-plans/current/active-block", response_model=CurrentPlanRecommendationOut)
async def update_current_preparation_plan_active_block(
    body: UserPlanActiveBlockIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreparationPlan)
        .where(UserPreparationPlan.user_id == user.id, UserPreparationPlan.status == "active")
        .order_by(UserPreparationPlan.id.desc())
    )
    user_plan = result.scalars().first()
    if not user_plan:
        raise HTTPException(status_code=404, detail="Active preparation plan not found")

    block_result = await db.execute(
        select(PreparationPlanBlock).where(
            PreparationPlanBlock.id == body.block_id,
            PreparationPlanBlock.plan_id == user_plan.plan_id,
        )
    )
    block = block_result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Plan block not found")

    user_plan.active_block_id = block.id
    await db.commit()
    await db.refresh(user_plan)
    return await _calculate_current_plan(user_plan, user, db)


@router.get(
    "/admin/preparation-plans",
    response_model=list[PreparationPlanOut],
    dependencies=[Depends(verify_parser_api_key)],
)
async def admin_list_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PreparationPlan)
        .options(selectinload(PreparationPlan.blocks))
        .order_by(PreparationPlan.target_score, PreparationPlan.id)
    )
    return [_plan_out(plan) for plan in result.scalars().unique().all()]


@router.get(
    "/admin/preparation-task-options",
    response_model=list[PreparationTaskOptionOut],
    dependencies=[Depends(verify_parser_api_key)],
)
async def admin_preparation_task_options(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Task, Topic)
        .join(Topic, Topic.id == Task.topic_id)
        .order_by(Topic.order_index, Task.order_index, Task.id)
    )
    options: list[PreparationTaskOptionOut] = []
    for task, topic in result.all():
        ege_number_max = _compute_ege_max(task)
        ege_label = _task_label(task)
        title_part = f" · {task.title}" if task.title else ""
        options.append(
            PreparationTaskOptionOut(
                id=task.id,
                topic_id=topic.id,
                topic_title=topic.title,
                topic_category=topic.category,
                topic_course_type=topic.course_type,
                order_index=task.order_index,
                ege_number=task.ege_number,
                ege_number_max=ege_number_max,
                title=task.title,
                label=f"{ege_label} · {topic.title}{title_part}",
            )
        )
    return options


@router.post(
    "/admin/preparation-plans",
    response_model=PreparationPlanOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_parser_api_key)],
)
async def admin_create_plan(body: PreparationPlanIn, db: AsyncSession = Depends(get_db)):
    plan = PreparationPlan(
        title=body.title.strip(),
        course_type=body.course_type,
        target_score=body.target_score,
        description=body.description,
        default_duration_days=body.default_duration_days,
        final_variants_count=body.final_variants_count,
        is_active=body.is_active,
    )
    db.add(plan)
    await db.flush()
    for idx, block in enumerate(body.blocks):
        db.add(
            PreparationPlanBlock(
                plan_id=plan.id,
                title=block.title.strip(),
                order_index=block.order_index if block.order_index is not None else idx,
                ege_numbers=block.ege_numbers,
                task_ids=block.task_ids,
                estimated_score=block.estimated_score,
                required_solved_count=block.required_solved_count,
                min_accuracy=block.min_accuracy,
                requires_control_work=block.requires_control_work,
                control_topic_id=block.control_topic_id,
                includes_variant=block.includes_variant,
            )
        )
    await db.commit()
    return _plan_out(await _get_plan_or_404(plan.id, db))


@router.put(
    "/admin/preparation-plans/{plan_id}",
    response_model=PreparationPlanOut,
    dependencies=[Depends(verify_parser_api_key)],
)
async def admin_update_plan(plan_id: int, body: PreparationPlanIn, db: AsyncSession = Depends(get_db)):
    plan = await _get_plan_or_404(plan_id, db)
    plan.title = body.title.strip()
    plan.course_type = body.course_type
    plan.target_score = body.target_score
    plan.description = body.description
    plan.default_duration_days = body.default_duration_days
    plan.final_variants_count = body.final_variants_count
    plan.is_active = body.is_active

    await db.execute(PreparationPlanBlock.__table__.delete().where(PreparationPlanBlock.plan_id == plan.id))
    for idx, block in enumerate(body.blocks):
        db.add(
            PreparationPlanBlock(
                plan_id=plan.id,
                title=block.title.strip(),
                order_index=block.order_index if block.order_index is not None else idx,
                ege_numbers=block.ege_numbers,
                task_ids=block.task_ids,
                estimated_score=block.estimated_score,
                required_solved_count=block.required_solved_count,
                min_accuracy=block.min_accuracy,
                requires_control_work=block.requires_control_work,
                control_topic_id=block.control_topic_id,
                includes_variant=block.includes_variant,
            )
        )
    await db.commit()
    return _plan_out(await _get_plan_or_404(plan.id, db))


@router.delete(
    "/admin/preparation-plans/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_parser_api_key)],
)
async def admin_delete_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    plan = await _get_plan_or_404(plan_id, db)
    await db.delete(plan)
    await db.commit()
