"""Group-owned lesson plan for students and administrators."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.group import Group, user_groups
from app.models.group_plan import GroupLesson, GroupLessonItem
from app.models.progress import ProgressStatus, UserProgress
from app.models.task import Task
from app.models.topic import Topic
from app.models.user import User
from app.schemas.group_plan import (
    GroupLessonIn,
    GroupLessonItemOut,
    GroupLessonOut,
    GroupPlanResourcesOut,
    GroupPlanTaskOptionOut,
    GroupPlanTopicOptionOut,
)

router = APIRouter(tags=["group-plan"])
admin_router = APIRouter(prefix="/admin", tags=["admin", "group-plan"], dependencies=[Depends(verify_parser_api_key)])


def _is_individual_group(group: Group) -> bool:
    normalized_name = group.name.strip().casefold()
    return normalized_name.startswith("индивидуал") or normalized_name.startswith("individual")


def _lesson_options():
    return (
        selectinload(GroupLesson.group),
        selectinload(GroupLesson.items).selectinload(GroupLessonItem.topic).selectinload(Topic.tasks),
        selectinload(GroupLesson.items)
        .selectinload(GroupLessonItem.task)
        .selectinload(Task.topic)
        .selectinload(Topic.tasks),
    )


def _task_title(task: Task, position: int | None = None) -> str:
    if task.title:
        return task.title
    if position is None and task.topic is not None:
        position = next(
            (index for index, topic_task in enumerate(task.topic.tasks, start=1) if topic_task.id == task.id),
            None,
        )
    return f"Задание {position if position is not None else task.order_index}"


def _topic_title(topic: Topic) -> str:
    if topic.ege_number is None:
        return topic.title
    number = str(topic.ege_number)
    if topic.ege_number_end is not None and topic.ege_number_end > topic.ege_number:
        number = f"{topic.ege_number}–{topic.ege_number_end}"
    return f"№{number} · {topic.title}"


def _item_out(item: GroupLessonItem, progress: dict[int, ProgressStatus]) -> GroupLessonItemOut:
    if item.task_id is not None and item.task is not None:
        task = item.task
        topic = task.topic
        solved = 1 if progress.get(task.id) == ProgressStatus.solved else 0
        completion = "completed" if solved else ("in_progress" if task.id in progress else "not_started")
        base = "/homework" if topic.category == "homework" else "/tasks"
        return GroupLessonItemOut(
            id=item.id,
            section=item.section,
            resource_type="task",
            topic_id=topic.id,
            task_id=task.id,
            title=_task_title(task),
            subtitle=topic.title,
            href=f"{base}/{topic.id}?task={task.id}&from=home",
            solved=solved,
            total=1,
            progress_percent=100 if solved else 0,
            completion_status=completion,
        )

    topic = item.topic
    if topic is None:
        return GroupLessonItemOut(id=item.id, section=item.section, resource_type="topic", topic_id=item.topic_id, title="Материал удалён", href="/tasks")
    task_ids = [task.id for task in topic.tasks]
    solved = sum(1 for task_id in task_ids if progress.get(task_id) == ProgressStatus.solved)
    attempted = any(task_id in progress for task_id in task_ids)
    total = len(task_ids)
    completion = "completed" if total > 0 and solved == total else ("in_progress" if attempted else "not_started")
    base = "/homework" if topic.category == "homework" else "/tasks"
    return GroupLessonItemOut(
        id=item.id,
        section=item.section,
        resource_type="topic",
        topic_id=topic.id,
        title=_topic_title(topic),
        subtitle=f"{solved} из {total} заданий",
        href=f"{base}/{topic.id}?from=home",
        solved=solved,
        total=total,
        progress_percent=round(solved / total * 100) if total else 0,
        completion_status=completion,
    )


def _lesson_out(lesson: GroupLesson, progress: dict[int, ProgressStatus] | None = None) -> GroupLessonOut:
    return GroupLessonOut(
        id=lesson.id,
        group_id=lesson.group_id,
        student_id=lesson.student_id,
        group_name=lesson.group.name,
        group_color=lesson.group.color,
        title=lesson.title,
        lesson_at=lesson.lesson_at,
        homework_deadline=lesson.homework_deadline,
        note=lesson.note,
        status=lesson.status,
        items=[_item_out(item, progress or {}) for item in lesson.items],
    )


async def _get_lesson(lesson_id: int, db: AsyncSession) -> GroupLesson:
    result = await db.execute(select(GroupLesson).options(*_lesson_options()).where(GroupLesson.id == lesson_id))
    lesson = result.scalars().unique().one_or_none()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


async def _validate_items(body: GroupLessonIn, db: AsyncSession) -> None:
    topic_ids = {item.topic_id for item in body.items if item.topic_id is not None}
    task_ids = {item.task_id for item in body.items if item.task_id is not None}
    if topic_ids:
        result = await db.execute(select(Topic.id).where(Topic.id.in_(topic_ids)))
        if set(result.scalars().all()) != topic_ids:
            raise HTTPException(status_code=400, detail="One or more topics do not exist")
    if task_ids:
        result = await db.execute(select(Task.id).where(Task.id.in_(task_ids)))
        if set(result.scalars().all()) != task_ids:
            raise HTTPException(status_code=400, detail="One or more tasks do not exist")


async def _validate_program_student(group: Group, student_id: int | None, db: AsyncSession) -> None:
    if _is_individual_group(group) and student_id is None:
        raise HTTPException(status_code=400, detail="Выберите ученика для индивидуальной программы")
    if not _is_individual_group(group) and student_id is not None:
        raise HTTPException(status_code=400, detail="Индивидуальная программа доступна только для группы «Индивидуалы»")
    if student_id is None:
        return
    membership = await db.execute(
        select(user_groups).where(
            user_groups.c.group_id == group.id,
            user_groups.c.user_id == student_id,
        )
    )
    if membership.first() is None:
        raise HTTPException(status_code=400, detail="Ученик не состоит в этой группе")


def _replace_items(lesson: GroupLesson, body: GroupLessonIn) -> None:
    lesson.items.clear()
    lesson.items.extend(
        GroupLessonItem(section=item.section, topic_id=item.topic_id, task_id=item.task_id, order_index=index)
        for index, item in enumerate(body.items)
    )


@router.get("/group-plan", response_model=list[GroupLessonOut])
async def get_group_plan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    groups_result = await db.execute(
        select(Group).join(user_groups, user_groups.c.group_id == Group.id).where(user_groups.c.user_id == user.id)
    )
    groups = list(groups_result.scalars().all())
    if not groups:
        return []
    shared_group_ids = [group.id for group in groups if not _is_individual_group(group)]
    individual_group_ids = [group.id for group in groups if _is_individual_group(group)]
    ownership_filters = []
    if shared_group_ids:
        ownership_filters.append(and_(GroupLesson.group_id.in_(shared_group_ids), GroupLesson.student_id.is_(None)))
    if individual_group_ids:
        ownership_filters.append(and_(GroupLesson.group_id.in_(individual_group_ids), GroupLesson.student_id == user.id))
    result = await db.execute(
        select(GroupLesson)
        .options(*_lesson_options())
        .where(or_(*ownership_filters), GroupLesson.status.in_(["published", "completed"]))
        .order_by(GroupLesson.lesson_at.desc(), GroupLesson.id.desc())
    )
    progress_result = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
    progress = {row.task_id: row.status for row in progress_result.scalars().all()}
    return [_lesson_out(lesson, progress) for lesson in result.scalars().unique().all()]


@admin_router.get("/group-plan/resources", response_model=GroupPlanResourcesOut)
async def get_group_plan_resources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).options(selectinload(Topic.tasks)).order_by(Topic.order_index, Topic.id))
    return GroupPlanResourcesOut(topics=[
        GroupPlanTopicOptionOut(
            id=topic.id,
            title=_topic_title(topic),
            category=topic.category,
            subject=topic.subject,
            tasks=[
                GroupPlanTaskOptionOut(
                    id=task.id,
                    title=_task_title(task, position),
                    ege_number=task.ege_number,
                    order_index=task.order_index,
                )
                for position, task in enumerate(topic.tasks, start=1)
            ],
        )
        for topic in result.scalars().unique().all()
    ])


@admin_router.get("/groups/{group_id}/lessons", response_model=list[GroupLessonOut])
async def list_group_lessons(
    group_id: int,
    student_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    await _validate_program_student(group, student_id, db)
    result = await db.execute(
        select(GroupLesson)
        .options(*_lesson_options())
        .where(GroupLesson.group_id == group_id, GroupLesson.student_id == student_id)
        .order_by(GroupLesson.lesson_at.desc(), GroupLesson.id.desc())
    )
    return [_lesson_out(lesson) for lesson in result.scalars().unique().all()]


@admin_router.post("/groups/{group_id}/lessons", response_model=GroupLessonOut, status_code=status.HTTP_201_CREATED)
async def create_group_lesson(
    group_id: int,
    body: GroupLessonIn,
    student_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    await _validate_program_student(group, student_id, db)
    await _validate_items(body, db)
    lesson = GroupLesson(group_id=group_id, student_id=student_id, title=body.title.strip(), lesson_at=body.lesson_at, homework_deadline=body.homework_deadline, note=body.note.strip() if body.note else None, status=body.status)
    _replace_items(lesson, body)
    db.add(lesson)
    await db.commit()
    return _lesson_out(await _get_lesson(lesson.id, db))


@admin_router.put("/group-lessons/{lesson_id}", response_model=GroupLessonOut)
async def update_group_lesson(lesson_id: int, body: GroupLessonIn, db: AsyncSession = Depends(get_db)):
    lesson = await _get_lesson(lesson_id, db)
    await _validate_items(body, db)
    lesson.title = body.title.strip()
    lesson.lesson_at = body.lesson_at
    lesson.homework_deadline = body.homework_deadline
    lesson.note = body.note.strip() if body.note else None
    lesson.status = body.status
    _replace_items(lesson, body)
    await db.commit()
    return _lesson_out(await _get_lesson(lesson.id, db))


@admin_router.delete("/group-lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_lesson(lesson_id: int, db: AsyncSession = Depends(get_db)):
    lesson = await _get_lesson(lesson_id, db)
    await db.delete(lesson)
    await db.commit()
