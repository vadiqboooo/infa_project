"""Content router — navigation tree, task details, admin sync."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.task import Task
from app.models.topic import Topic
from app.models.user import User
from app.models.progress import UserProgress
from app.schemas.navigation import TaskNav, TopicNav
from app.schemas.task import TaskOut, TaskSyncIn, TaskSyncResult

router = APIRouter(tags=["content"])


@router.get("/navigation", response_model=list[TopicNav])
async def get_navigation(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return sidebar navigation tree: topics → tasks with user progress."""
    # Загружаем темы с задачами (сортировка определена в модели)
    result = await db.execute(
        select(Topic).options(selectinload(Topic.tasks)).order_by(Topic.order_index)
    )
    topics = result.scalars().unique().all()

    # Fetch all progress for user in one query
    prog_result = await db.execute(
        select(UserProgress).where(UserProgress.user_id == user.id)
    )
    progress_map: dict[int, str] = {
        p.task_id: p.status.value for p in prog_result.scalars().all()
    }

    # Fetch latest exam attempts
    from app.models.exam import Exam
    from app.models.exam_attempt import ExamAttempt

    attempts_query = await db.execute(
        select(ExamAttempt, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .where(ExamAttempt.user_id == user.id)
        .order_by(ExamAttempt.finished_at.desc())
    )
    # Map topic_id -> (score, total_tasks, exam_id)
    exam_map = {}
    for attempt, exam in attempts_query.all():
        if exam.topic_id not in exam_map:
            # First one is the latest due to order_by
            exam_map[exam.topic_id] = {
                "score": attempt.score,
                "max_score": len(exam.tasks) if exam.tasks else 0,
                "exam_id": exam.id
            }

    nav: list[TopicNav] = []
    for topic in topics:
        tasks_nav = [
            TaskNav(
                id=t.id,
                external_id=t.external_id,
                status=progress_map.get(t.id, "not_started"),
            )
            for t in topic.tasks
        ]
        
        exam_data = exam_map.get(topic.id, {})
        
        nav.append(TopicNav(
            id=topic.id,
            title=topic.title,
            order_index=topic.order_index,
            category=topic.category,
            tasks=tasks_nav,
            exam_id=exam_data.get("exam_id"),
            latest_score=exam_data.get("score"),
            max_score=exam_data.get("max_score"),
        ))
    return nav


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return task details (HTML content, media, answer type)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post(
    "/tasks/sync",
    response_model=TaskSyncResult,
    dependencies=[Depends(verify_parser_api_key)],
)
async def sync_tasks(
    body: TaskSyncIn,
    db: AsyncSession = Depends(get_db),
):
    """Admin / Parser: bulk upsert tasks by external_id."""
    created = 0
    updated = 0

    for item in body.tasks:
        result = await db.execute(
            select(Task).where(Task.external_id == item.external_id)
        )
        existing = result.scalar_one_or_none()

        if existing is None:
            task = Task(
                external_id=item.external_id,
                topic_id=item.topic_id,
                content_html=item.content_html,
                media_resources=item.media_resources,
                answer_type=item.answer_type,
                correct_answer=item.correct_answer,
            )
            db.add(task)
            created += 1
        else:
            existing.topic_id = item.topic_id
            existing.content_html = item.content_html
            existing.media_resources = item.media_resources
            existing.answer_type = item.answer_type
            existing.correct_answer = item.correct_answer
            updated += 1

    await db.commit()
    return TaskSyncResult(created=created, updated=updated)
