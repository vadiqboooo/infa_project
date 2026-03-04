"""Exams router — start / submit exam attempts."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.exam import Exam, exam_tasks
from app.models.exam_attempt import ExamAttempt
from app.models.task import Task
from app.models.user import User
from app.schemas.exam import ExamResult, ExamStartResponse, ExamSubmitIn

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/by-topic/{topic_id}")
async def get_exam_by_topic(
    topic_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get exam for a topic (variant). Creates one if it doesn't exist."""
    result = await db.execute(
        select(Exam).options(selectinload(Exam.tasks)).where(Exam.topic_id == topic_id)
    )
    exam = result.scalar_one_or_none()

    # Auto-create exam if it doesn't exist (for old variants)
    if exam is None:
        from app.models.topic import Topic

        # Load all tasks for this topic
        tasks_result = await db.execute(select(Task).where(Task.topic_id == topic_id))
        tasks = list(tasks_result.scalars().all())

        # Check if topic exists
        topic_result = await db.execute(select(Topic).where(Topic.id == topic_id))
        topic = topic_result.scalar_one_or_none()
        if topic is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

        exam = Exam(topic_id=topic_id, time_limit_minutes=235)
        db.add(exam)
        await db.flush()

        # Associate all tasks with this exam using the association table
        if tasks:
            values = [{"exam_id": exam.id, "task_id": task.id} for task in tasks]
            await db.execute(exam_tasks.insert(), values)

        await db.commit()

        # Reload exam with tasks
        result = await db.execute(
            select(Exam).options(selectinload(Exam.tasks)).where(Exam.id == exam.id)
        )
        exam = result.scalar_one()

    # Check for active attempt
    active_attempt = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.finished_at.is_(None),
        )
    )
    attempt = active_attempt.scalar_one_or_none()

    # Check for latest finished attempt
    finished_attempt = await db.execute(
        select(ExamAttempt)
        .where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.finished_at.is_not(None),
        )
        .order_by(ExamAttempt.finished_at.desc())
        .limit(1)
    )
    finished = finished_attempt.scalar_one_or_none()

    return {
        "id": exam.id,
        "topic_id": exam.topic_id,
        "time_limit_minutes": exam.time_limit_minutes,
        "task_count": len(exam.tasks),
        "active_attempt": {
            "id": attempt.id,
            "started_at": attempt.started_at,
        } if attempt else None,
        "finished_attempt": {
            "id": finished.id,
            "started_at": finished.started_at,
            "finished_at": finished.finished_at,
            "score": finished.score,
        } if finished else None,
    }


@router.get("/{exam_id}")
async def get_exam(
    exam_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get exam details including active attempt if any."""
    result = await db.execute(
        select(Exam).options(selectinload(Exam.tasks)).where(Exam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    # Check for active attempt
    active_attempt = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.finished_at.is_(None),
        )
    )
    attempt = active_attempt.scalar_one_or_none()

    return {
        "id": exam.id,
        "topic_id": exam.topic_id,
        "time_limit_minutes": exam.time_limit_minutes,
        "task_count": len(exam.tasks),
        "active_attempt": {
            "id": attempt.id,
            "started_at": attempt.started_at,
        } if attempt else None,
    }


@router.post("/{exam_id}/start", response_model=ExamStartResponse)
async def start_exam(
    exam_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an exam attempt — records start time, disables AI hints for these tasks."""
    # Verify exam exists
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    # Check for already-active attempt
    active = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.finished_at.is_(None),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Exam already in progress")

    # Check for finished attempt - prevent retaking
    finished = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.finished_at.is_not(None),
        )
    )
    if finished.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Exam already completed")

    attempt = ExamAttempt(user_id=user.id, exam_id=exam_id)
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    return ExamStartResponse(
        attempt_id=attempt.id,
        started_at=attempt.started_at,
        time_limit_minutes=exam.time_limit_minutes,
    )


@router.post("/{exam_id}/submit", response_model=ExamResult)
async def submit_exam(
    exam_id: int,
    body: ExamSubmitIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit answers for all exam tasks, compute score, and close the attempt."""
    # Get active attempt
    attempt_result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.user_id == user.id,
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.finished_at.is_(None),
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active exam attempt found",
        )

    # Load exam with tasks
    exam_result = await db.execute(
        select(Exam).options(selectinload(Exam.tasks)).where(Exam.id == exam_id)
    )
    exam = exam_result.scalar_one_or_none()
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    # Build task lookup
    task_map: dict[int, Task] = {t.id: t for t in exam.tasks}
    total = len(task_map)
    correct_count = 0

    from app.routers.solving import _answers_equal
    from app.models.progress import UserProgress, ProgressStatus

    for answer_item in body.answers:
        task = task_map.get(answer_item.task_id)
        if task is None:
            continue
        
        is_correct = _answers_equal(task.correct_answer, answer_item.answer)
        if is_correct:
            correct_count += 1

        # Sync with UserProgress so navigation shows solved tasks
        prog_result = await db.execute(
            select(UserProgress).where(
                UserProgress.user_id == user.id,
                UserProgress.task_id == task.id,
            )
        )
        progress = prog_result.scalar_one_or_none()

        if progress is None:
            progress = UserProgress(
                user_id=user.id,
                task_id=task.id,
                status=ProgressStatus.solved if is_correct else ProgressStatus.failed,
                attempts_count=1,
                last_attempt_at=datetime.now(timezone.utc),
            )
            db.add(progress)
        else:
            progress.attempts_count += 1
            progress.last_attempt_at = datetime.now(timezone.utc)
            # Only upgrade status to solved, don't downgrade if they already solved it before
            if is_correct:
                progress.status = ProgressStatus.solved

    score = (correct_count / total * 100) if total > 0 else 0.0
    now = datetime.now(timezone.utc)

    attempt.finished_at = now
    attempt.score = score
    await db.commit()
    await db.refresh(attempt)

    return ExamResult(
        attempt_id=attempt.id,
        total_tasks=total,
        correct_count=correct_count,
        score=score,
        finished_at=now,
    )
