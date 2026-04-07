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
    # Load topics with tasks
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

    # Fetch all exams to get time limits and task counts
    from app.models.exam import Exam
    from app.models.exam_attempt import ExamAttempt
    from app.models.exam_analysis import ExamAnalysis

    all_exams_result = await db.execute(
        select(Exam).options(selectinload(Exam.tasks))
    )
    all_exams = {e.topic_id: e for e in all_exams_result.scalars().unique().all()}

    # Fetch latest exam attempts for the user
    attempts_query = await db.execute(
        select(ExamAttempt, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .where(ExamAttempt.user_id == user.id)
        .order_by(ExamAttempt.finished_at.desc())
    )

    # Map topic_id -> latest attempt data
    latest_attempts: dict[int, dict] = {}
    # Map topic_id -> draft answers count from active (unfinished) attempts
    active_draft_counts: dict[int, int] = {}
    for attempt, exam in attempts_query.all():
        if attempt.finished_at is None:
            # Active attempt — count draft answers
            drafts = (attempt.results_json or {}).get("draft_answers", {})
            non_empty = sum(1 for v in drafts.values() if v and v.get("val") not in (None, "", []))
            active_draft_counts[exam.topic_id] = non_empty
        elif exam.topic_id not in latest_attempts:
            latest_attempts[exam.topic_id] = {
                "score": attempt.score,
                "primary_score": attempt.primary_score,
                "attempt_id": attempt.id,
            }

    # Check which latest attempts have a published analysis
    attempt_ids = [v["attempt_id"] for v in latest_attempts.values() if v.get("attempt_id")]
    published_ids: set[int] = set()
    if attempt_ids:
        pub_res = await db.execute(
            select(ExamAnalysis.attempt_id).where(
                ExamAnalysis.attempt_id.in_(attempt_ids),
                ExamAnalysis.is_published.is_(True),
            )
        )
        published_ids = {row[0] for row in pub_res.all()}

    nav: list[TopicNav] = []
    for topic in topics:
        tasks_nav = [
            TaskNav(
                id=t.id,
                external_id=t.external_id,
                ege_number=t.ege_number,
                status=progress_map.get(t.id, "not_started"),
                has_solution=bool(t.solution_steps and len(t.solution_steps) > 0),
            )
            for t in topic.tasks
        ]
        
        exam = all_exams.get(topic.id)
        latest_attempt = latest_attempts.get(topic.id, {})
        
        attempt_id = latest_attempt.get("attempt_id")
        nav.append(TopicNav(
            id=topic.id,
            title=topic.title,
            order_index=topic.order_index,
            category=topic.category,
            tasks=tasks_nav,
            exam_id=exam.id if exam else None,
            latest_score=latest_attempt.get("score"),
            latest_primary_score=latest_attempt.get("primary_score"),
            max_score=len(exam.tasks) if exam and exam.tasks else len(topic.tasks),
            time_limit_minutes=exam.time_limit_minutes if exam else 60,
            is_mock=topic.is_mock,
            ege_number=topic.ege_number,
            analysis_published=attempt_id in published_ids if attempt_id else False,
            draft_count=active_draft_counts.get(topic.id, 0),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
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
