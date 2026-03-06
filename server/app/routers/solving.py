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

    if expected is None or user_val is None:
        return False

    # Helper to convert anything to float if possible
    def to_float(v):
        try:
            if isinstance(v, str):
                return float(v.replace(",", ".").strip())
            return float(v)
        except (ValueError, TypeError, AttributeError):
            return None

    # 1. Comparison for single values (number or text)
    if not isinstance(expected, list) and not isinstance(user_val, list):
        # Try numeric comparison first
        f_exp = to_float(expected)
        f_user = to_float(user_val)
        if f_exp is not None and f_user is not None:
            return abs(f_exp - f_user) < 1e-9
        
        # Fallback to string comparison
        return str(expected).strip().lower() == str(user_val).strip().lower()

    # 2. Comparison for lists (pair or table)
    if isinstance(expected, list) and isinstance(user_val, list):
        if len(expected) != len(user_val):
            return False
        
        if len(expected) == 0:
            return True

        # Check if it's a table (list of lists)
        if isinstance(expected[0], list):
            for row_e, row_u in zip(expected, user_val):
                if not isinstance(row_u, list) or len(row_e) != len(row_u):
                    return False
                for a, b in zip(row_e, row_u):
                    fa, fb = to_float(a), to_float(b)
                    if fa is not None and fb is not None:
                        if abs(fa - fb) >= 1e-9: return False
                    elif str(a).strip().lower() != str(b).strip().lower():
                        return False
            return True
        else:
            # It's a pair or simple list
            for a, b in zip(expected, user_val):
                fa, fb = to_float(a), to_float(b)
                if fa is not None and fb is not None:
                    if abs(fa - fb) >= 1e-9: return False
                elif str(a).strip().lower() != str(b).strip().lower():
                    return False
            return True

    return False


def _partial_score(correct: dict | None, given: AnswerIn, ege_number: int | None) -> int:
    """Return partial score for tasks 26/27 (0, 1, or 2).

    Task 26 (pair): each matching element = 1 point, max 2.
    Task 27 (table 2×2): each matching row (pair) = 1 point, max 2.
    """
    if correct is None or ege_number not in (26, 27):
        return 0

    expected = correct.get("val")
    user_val = given.val
    if expected is None or user_val is None:
        return 0

    def to_float(v):
        try:
            if isinstance(v, str):
                return float(v.replace(",", ".").strip())
            return float(v)
        except (ValueError, TypeError, AttributeError):
            return None

    def vals_eq(a, b) -> bool:
        fa, fb = to_float(a), to_float(b)
        if fa is not None and fb is not None:
            return abs(fa - fb) < 1e-9
        return str(a).strip().lower() == str(b).strip().lower()

    if ege_number == 26:
        # Pair answer: [a, b] — each matching element is 1 point
        if not isinstance(expected, list) or not isinstance(user_val, list):
            return 0
        score = 0
        for a, b in zip(expected, user_val):
            if vals_eq(a, b):
                score += 1
        return min(score, 2)

    if ege_number == 27:
        # Table answer: [[a,b],[c,d]] — each matching row is 1 point
        if not isinstance(expected, list) or not isinstance(user_val, list):
            return 0
        score = 0
        for row_e, row_u in zip(expected, user_val):
            if not isinstance(row_e, list) or not isinstance(row_u, list):
                continue
            if len(row_e) == len(row_u) and all(vals_eq(a, b) for a, b in zip(row_e, row_u)):
                score += 1
        return min(score, 2)

    return 0


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

SYSTEM_PROMPT = """Ты — образовательный ассистент для школьников и студентов.

Твоя задача:
- Помогать разобраться в задаче, задавая наводящие вопросы
- Объяснять концепции простым языком
- Давать подсказки шаг за шагом
- НИКОГДА не давать прямой числовой ответ

Стиль общения:
- Дружелюбный и поддерживающий
- Краткие ответы (2-4 предложения)
- Используй примеры и аналогии

Отвечай на русском языке."""


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
            # OpenRouter требует дополнительные заголовки
            headers = {
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",  # Для OpenRouter
                "X-Title": "Edu Platform",  # Для OpenRouter
            }

            payload = {
                "model": settings.LLM_MODEL,
                "messages": messages,
            }

            print(f"[AI] Запрос к {settings.LLM_BASE_URL}/chat/completions")
            print(f"[AI] Модель: {settings.LLM_MODEL}")

            resp = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

            print(f"[AI] Статус: {resp.status_code}")

            if resp.status_code != 200:
                error_text = resp.text
                print(f"[AI] Ошибка: {error_text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LLM API вернул {resp.status_code}: {error_text}",
                )

            data = resp.json()
            ai_text = data["choices"][0]["message"]["content"]
            print(f"[AI] Ответ получен: {len(ai_text)} символов")

    except httpx.HTTPError as exc:
        print(f"[AI] HTTP ошибка: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка подключения к LLM API: {str(exc)}",
        )
    except Exception as exc:
        print(f"[AI] Неожиданная ошибка: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка обработки ответа LLM: {str(exc)}",
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
