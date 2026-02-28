"""Solving router — answer checking & AI-assisted hints."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.ai_chat_log import AIChatLog
from app.models.exam_attempt import ExamAttempt
from app.models.progress import ProgressStatus, UserProgress
from app.models.task import Task
from app.models.user import User
from app.schemas.ai import AIAssistRequest, AIAssistResponse
from app.schemas.task import AnswerIn, CheckResult

router = APIRouter(prefix="/tasks", tags=["solving"])


# ── Helpers ───────────────────────────────────────────────────

def _answers_equal(correct: dict | None, given: AnswerIn) -> bool:
    """Compare user answer with correct answer following the TZ format."""
    if correct is None:
        return False
    expected = correct.get("val")
    user_val = given.val

    if isinstance(expected, (int, float)) and isinstance(user_val, (int, float)):
        return abs(float(expected) - float(user_val)) < 1e-9

    if isinstance(expected, list) and isinstance(user_val, list):
        if len(expected) != len(user_val):
            return False
        # could be pair or table
        if expected and isinstance(expected[0], list):
            # table
            for row_e, row_u in zip(expected, user_val):
                if not isinstance(row_u, list) or len(row_e) != len(row_u):
                    return False
                for a, b in zip(row_e, row_u):
                    if abs(float(a) - float(b)) >= 1e-9:
                        return False
            return True
        else:
            # pair
            for a, b in zip(expected, user_val):
                if abs(float(a) - float(b)) >= 1e-9:
                    return False
            return True

    return False


async def _is_task_in_active_exam(task_id: int, user_id: int, db: AsyncSession) -> bool:
    """Check whether a task belongs to an exam the user is currently taking."""
    from app.models.exam import exam_tasks

    result = await db.execute(
        select(ExamAttempt)
        .join(exam_tasks, exam_tasks.c.exam_id == ExamAttempt.exam_id)  # type: ignore[arg-type]
        .where(
            exam_tasks.c.task_id == task_id,
            ExamAttempt.user_id == user_id,
            ExamAttempt.finished_at.is_(None),
        )
    )
    return result.scalar_one_or_none() is not None


# ── Check answer ──────────────────────────────────────────────

@router.post("/{task_id}/check", response_model=CheckResult)
async def check_answer(
    task_id: int,
    body: AnswerIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare user answer with correct_answer and update progress."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    correct = _answers_equal(task.correct_answer, body)

    # Upsert progress
    prog_result = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == user.id,
            UserProgress.task_id == task_id,
        )
    )
    progress = prog_result.scalar_one_or_none()

    if progress is None:
        progress = UserProgress(
            user_id=user.id,
            task_id=task_id,
            status=ProgressStatus.solved if correct else ProgressStatus.failed,
            attempts_count=1,
            last_attempt_at=datetime.now(timezone.utc),
        )
        db.add(progress)
    else:
        progress.attempts_count += 1
        progress.last_attempt_at = datetime.now(timezone.utc)
        if correct:
            progress.status = ProgressStatus.solved

    await db.commit()
    await db.refresh(progress)

    return CheckResult(
        correct=correct,
        attempts_count=progress.attempts_count,
        status=progress.status.value,
    )


# ── AI Assist ─────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "Ты — образовательный ассистент. Помогай ученику разобраться в задаче, "
    "задавай наводящие вопросы. НИКОГДА не давай прямой ответ. "
    "Подсказывай шаг за шагом."
)


@router.post("/{task_id}/ai-assist", response_model=AIAssistResponse)
async def ai_assist(
    task_id: int,
    body: AIAssistRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a hint from the LLM (without giving the final answer)."""
    # Block AI hints during active exam
    if await _is_task_in_active_exam(task_id, user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI hints are disabled during exams",
        )

    # Get task context
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Get recent error history
    logs_result = await db.execute(
        select(AIChatLog)
        .where(AIChatLog.user_id == user.id, AIChatLog.task_id == task_id)
        .order_by(AIChatLog.created_at.desc())
        .limit(5)
    )
    history = logs_result.scalars().all()

    # Build messages for LLM
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.append({
        "role": "system",
        "content": f"Задача:\n{task.content_html}",
    })
    for log in reversed(history):
        messages.append({"role": "user", "content": log.user_query})
        messages.append({"role": "assistant", "content": log.ai_response})
    messages.append({"role": "user", "content": body.user_query})

    # Call LLM API
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                json={"model": settings.LLM_MODEL, "messages": messages},
            )
            resp.raise_for_status()
            ai_text = resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM request failed: {exc}",
        )

    # Save to log
    log_entry = AIChatLog(
        user_id=user.id,
        task_id=task_id,
        mode=body.mode,
        user_query=body.user_query,
        ai_response=ai_text,
    )
    db.add(log_entry)
    await db.commit()

    return AIAssistResponse(hint=ai_text)
