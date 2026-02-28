"""Exams router — start / submit exam attempts."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.exam import Exam
from app.models.exam_attempt import ExamAttempt
from app.models.task import Task
from app.models.user import User
from app.schemas.exam import ExamResult, ExamStartResponse, ExamSubmitIn

router = APIRouter(prefix="/exams", tags=["exams"])


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

    for answer_item in body.answers:
        task = task_map.get(answer_item.task_id)
        if task is None:
            continue
        if _answers_equal(task.correct_answer, answer_item.answer):
            correct_count += 1

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
