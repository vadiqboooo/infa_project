"""Solving router — answer checking & AI-assisted hints."""

from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.dependencies import get_current_user, get_db
from app.models.ai_chat_log import AIChatLog
from app.models.exam_attempt import ExamAttempt
from app.models.progress import ProgressStatus, UserProgress
from app.models.task import Task
from app.models.task_solution import UserTaskSolution
from app.models.task_solution_comment import UserTaskSolutionComment
from app.models.task_solution_comment_read import UserTaskSolutionCommentRead
from app.models.task_solution_comment_reaction import UserTaskSolutionCommentReaction
from app.models.topic import Topic
from app.models.user import User
from app.realtime import solution_comment_ws_manager
from app.schemas.ai import AIAssistRequest, AIAssistResponse
from app.schemas.task import AnswerIn, CheckResult

router = APIRouter(prefix="/tasks", tags=["solving"])


class TaskSolutionIn(BaseModel):
    code: str | None = None


class TaskSolutionCommentOut(BaseModel):
    id: int
    from_offset: int | None = None
    to_offset: int | None = None
    from_line: int
    from_col: int
    to_line: int
    to_col: int
    text: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    reaction: str | None = None


class TaskSolutionOut(BaseModel):
    task_id: int
    code: str | None = None
    file_url: str | None = None
    image_url: str | None = None
    updated_at: datetime | None = None
    comments: list[TaskSolutionCommentOut] = []


class SolutionCommentNotificationOut(BaseModel):
    id: int
    task_id: int
    topic_id: int
    topic_category: str
    topic_title: str
    task_title: str | None = None
    task_order_index: int
    ege_number: int | None = None
    text: str
    from_line: int
    to_line: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_read: bool = False


class SolutionCommentNotificationsReadIn(BaseModel):
    comment_ids: list[int] | None = None


class SolutionCommentReactionIn(BaseModel):
    reaction: str


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


def _per_element_correctness(correct: dict | None, given: AnswerIn, ege_number: int | None):
    """Return (partial_list, expected_value) for tasks 26/27.

    26 → list[bool] length 2 (pair)
    27 → list[list[bool]] shape 2x2 (table)
    Other → (None, None)
    """
    if correct is None or ege_number not in (26, 27):
        return None, None

    expected = correct.get("val")
    user_val = given.val
    if expected is None:
        return None, None

    def to_float(v):
        try:
            if isinstance(v, str):
                return float(v.replace(",", ".").strip())
            return float(v)
        except (ValueError, TypeError, AttributeError):
            return None

    def vals_eq(a, b) -> bool:
        if a is None or b is None or b == "":
            return False
        fa, fb = to_float(a), to_float(b)
        if fa is not None and fb is not None:
            return abs(fa - fb) < 1e-9
        return str(a).strip().lower() == str(b).strip().lower()

    if ege_number == 26:
        if not isinstance(expected, list):
            return None, expected
        u = user_val if isinstance(user_val, list) else []
        partial = [vals_eq(expected[i], u[i] if i < len(u) else None) for i in range(len(expected))]
        return partial, expected

    if ege_number == 27:
        if not isinstance(expected, list):
            return None, expected
        u = user_val if isinstance(user_val, list) else []
        partial: list[list[bool]] = []
        for ri, row_e in enumerate(expected):
            if not isinstance(row_e, list):
                continue
            row_u = u[ri] if ri < len(u) and isinstance(u[ri], list) else []
            partial.append([vals_eq(row_e[ci], row_u[ci] if ci < len(row_u) else None) for ci in range(len(row_e))])
        return partial, expected

    return None, None


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

async def _get_or_create_solution(db: AsyncSession, user_id: int, task_id: int) -> UserTaskSolution:
    if await db.get(Task, task_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    result = await db.execute(
        select(UserTaskSolution).where(
            UserTaskSolution.user_id == user_id,
            UserTaskSolution.task_id == task_id,
        )
    )
    solution = result.scalar_one_or_none()
    if solution is None:
        solution = UserTaskSolution(user_id=user_id, task_id=task_id)
        db.add(solution)
    return solution


def _solution_out(
    task_id: int,
    solution: UserTaskSolution | None,
    comments: list[UserTaskSolutionComment] | None = None,
    reactions_by_comment_id: dict[int, str] | None = None,
) -> TaskSolutionOut:
    if solution is None:
        return TaskSolutionOut(task_id=task_id)
    return TaskSolutionOut(
        task_id=task_id,
        code=solution.code,
        file_url=solution.file_url,
        image_url=solution.image_url,
        updated_at=solution.updated_at,
        comments=[
            TaskSolutionCommentOut(
                id=comment.id,
                from_offset=comment.from_offset,
                to_offset=comment.to_offset,
                from_line=comment.from_line,
                from_col=comment.from_col,
                to_line=comment.to_line,
                to_col=comment.to_col,
                text=comment.text,
                created_at=comment.created_at,
                updated_at=comment.updated_at,
                reaction=(reactions_by_comment_id or {}).get(comment.id),
            )
            for comment in (comments or [])
        ],
    )


@router.get("/solution-comments/notifications", response_model=list[SolutionCommentNotificationOut])
async def get_solution_comment_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all teacher comments attached to the current student's task solutions."""
    result = await db.execute(
        select(UserTaskSolutionComment, UserTaskSolution, Task, Topic, UserTaskSolutionCommentRead.id)
        .join(UserTaskSolution, UserTaskSolution.id == UserTaskSolutionComment.solution_id)
        .join(Task, Task.id == UserTaskSolution.task_id)
        .join(Topic, Topic.id == Task.topic_id)
        .outerjoin(
            UserTaskSolutionCommentRead,
            (UserTaskSolutionCommentRead.comment_id == UserTaskSolutionComment.id)
            & (UserTaskSolutionCommentRead.user_id == user.id),
        )
        .where(UserTaskSolution.user_id == user.id)
        .order_by(UserTaskSolutionComment.updated_at.desc(), UserTaskSolutionComment.id.desc())
    )
    return [
        SolutionCommentNotificationOut(
            id=comment.id,
            task_id=task.id,
            topic_id=topic.id,
            topic_category=topic.category,
            topic_title=topic.title,
            task_title=task.title,
            task_order_index=task.order_index,
            ege_number=task.ege_number,
            text=comment.text,
            from_line=comment.from_line,
            to_line=comment.to_line,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            is_read=read_id is not None,
        )
        for comment, _, task, topic, read_id in result.all()
    ]


@router.post("/solution-comments/notifications/read")
async def mark_solution_comment_notifications_read(
    body: SolutionCommentNotificationsReadIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark current student's comment notifications as read without deleting history."""
    query = (
        select(UserTaskSolutionComment.id)
        .join(UserTaskSolution, UserTaskSolution.id == UserTaskSolutionComment.solution_id)
        .where(UserTaskSolution.user_id == user.id)
    )
    if body.comment_ids:
        query = query.where(UserTaskSolutionComment.id.in_(body.comment_ids))

    result = await db.execute(query)
    comment_ids = [row[0] for row in result.all()]
    if not comment_ids:
        return {"ok": True, "read_count": 0}

    existing_result = await db.execute(
        select(UserTaskSolutionCommentRead.comment_id).where(
            UserTaskSolutionCommentRead.user_id == user.id,
            UserTaskSolutionCommentRead.comment_id.in_(comment_ids),
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}
    new_ids = [comment_id for comment_id in comment_ids if comment_id not in existing_ids]

    for comment_id in new_ids:
        db.add(UserTaskSolutionCommentRead(user_id=user.id, comment_id=comment_id))

    await db.commit()
    return {"ok": True, "read_count": len(new_ids)}


@router.get("/{task_id}/solution", response_model=TaskSolutionOut)
async def get_own_task_solution(task_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserTaskSolution).where(UserTaskSolution.user_id == user.id, UserTaskSolution.task_id == task_id)
    )
    solution = result.scalar_one_or_none()
    comments: list[UserTaskSolutionComment] = []
    reactions_by_comment_id: dict[int, str] = {}
    if solution is not None:
        comments_result = await db.execute(
            select(UserTaskSolutionComment)
            .where(UserTaskSolutionComment.solution_id == solution.id)
            .order_by(UserTaskSolutionComment.from_line, UserTaskSolutionComment.from_col, UserTaskSolutionComment.id)
        )
        comments = list(comments_result.scalars().all())
        comment_ids = [comment.id for comment in comments]
        if comment_ids:
            reactions_result = await db.execute(
                select(UserTaskSolutionCommentReaction.comment_id, UserTaskSolutionCommentReaction.reaction).where(
                    UserTaskSolutionCommentReaction.user_id == user.id,
                    UserTaskSolutionCommentReaction.comment_id.in_(comment_ids),
                )
            )
            reactions_by_comment_id = {comment_id: reaction for comment_id, reaction in reactions_result.all()}
    return _solution_out(task_id, solution, comments, reactions_by_comment_id)


@router.post("/solution-comments/{comment_id}/reaction")
async def set_solution_comment_reaction(
    comment_id: int,
    body: SolutionCommentReactionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.reaction not in {"fixed", "need_help"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reaction")

    result = await db.execute(
        select(UserTaskSolutionCommentReaction).where(
            UserTaskSolutionCommentReaction.user_id == user.id,
            UserTaskSolutionCommentReaction.comment_id == comment_id,
        )
    )
    reaction = result.scalar_one_or_none()
    if reaction is None:
        comment_result = await db.execute(
            select(UserTaskSolutionComment)
            .join(UserTaskSolution, UserTaskSolution.id == UserTaskSolutionComment.solution_id)
            .where(UserTaskSolutionComment.id == comment_id, UserTaskSolution.user_id == user.id)
        )
        if comment_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        reaction = UserTaskSolutionCommentReaction(
            user_id=user.id,
            comment_id=comment_id,
            reaction=body.reaction,
        )
        db.add(reaction)
    else:
        reaction.reaction = body.reaction

    await db.commit()
    return {"ok": True, "reaction": body.reaction}


@router.websocket("/{task_id}/solution/comments/ws")
async def task_solution_comments_ws(
    websocket: WebSocket,
    task_id: int,
    token: str = Query(...),
):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        task = await db.get(Task, task_id)
        if user is None or task is None:
            await websocket.close(code=1008)
            return

    await solution_comment_ws_manager.connect(user_id, task_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        solution_comment_ws_manager.disconnect(user_id, task_id, websocket)


@router.put("/{task_id}/solution", response_model=TaskSolutionOut)
async def save_own_task_solution(task_id: int, body: TaskSolutionIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    solution = await _get_or_create_solution(db, user.id, task_id)
    solution.code = body.code
    await db.commit()
    await db.refresh(solution)
    return _solution_out(task_id, solution)


ALLOWED_SOLUTION_FILE_EXTENSIONS = {".py", ".txt", ".doc", ".docx", ".pdf", ".xlsx", ".xls", ".csv", ".ods", ".zip"}
ALLOWED_SOLUTION_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_SOLUTION_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post("/{task_id}/solution/upload/{kind}", response_model=TaskSolutionOut)
async def upload_own_task_solution_file(
    task_id: int,
    kind: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if kind not in {"file", "image"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload kind")
    suffix = Path(file.filename or "").suffix.lower()
    allowed = ALLOWED_SOLUTION_IMAGE_EXTENSIONS if kind == "image" else ALLOWED_SOLUTION_FILE_EXTENSIONS
    if suffix not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type not allowed")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > MAX_SOLUTION_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is too large")
    solution = await _get_or_create_solution(db, user.id, task_id)
    upload_dir = Path(f"uploads/task_solutions/{user.id}/{task_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix_path = upload_dir / f"{kind}{suffix}"
    suffix_path.write_bytes(data)
    url = f"/uploads/task_solutions/{user.id}/{task_id}/{kind}{suffix}"
    if kind == "image":
        solution.image_url = url
    else:
        solution.file_url = url
    await db.commit()
    await db.refresh(solution)
    return _solution_out(task_id, solution)


@router.post("/{task_id}/check", response_model=CheckResult)
async def check_answer(
    task_id: int,
    body: AnswerIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare user answer with correct_answer and update progress.

    For tasks with sub_tasks, body.answers must be a list:
      answers[0] = main task answer
      answers[1..] = sub-task answers (in order)
    Task is considered solved only when ALL answers are correct.
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    sub_results: list[bool] | None = None
    has_subs = bool(task.sub_tasks)

    if has_subs:
        # Multi-answer mode. Expect body.answers list.
        answers_list = body.answers if body.answers is not None else ([body.val] if body.val is not None else [])
        # Build expected list: main + each sub
        expected_list = [task.correct_answer]
        for sub in (task.sub_tasks or []):
            expected_list.append(sub.get("correct_answer"))

        sub_results = []
        for i, exp in enumerate(expected_list):
            user_v = answers_list[i] if i < len(answers_list) else None
            if user_v is None:
                sub_results.append(False)
                continue
            given = AnswerIn(val=user_v)
            sub_results.append(_answers_equal(exp, given))

        correct = all(sub_results) if sub_results else False
    else:
        # Legacy single-answer mode
        if body.val is None and body.answers:
            given = AnswerIn(val=body.answers[0]) if body.answers[0] is not None else AnswerIn(val=0)
        else:
            given = body
        correct = _answers_equal(task.correct_answer, given)

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

    # For tasks 26/27 — compute per-element correctness for visual feedback
    partial_correct = None
    if not has_subs and task.ege_number in (26, 27):
        given_for_partial = body if body.val is not None else AnswerIn(val=body.answers[0] if body.answers else 0)
        partial_correct, _ = _per_element_correctness(
            task.correct_answer, given_for_partial, task.ege_number,
        )

    return CheckResult(
        correct=correct,
        attempts_count=progress.attempts_count,
        status=progress.status.value,
        sub_results=sub_results,
        partial_correct=partial_correct,
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

MENTOR_SYSTEM_PROMPT = """Ты — наставник по программированию для школьников, готовящихся к ЕГЭ по информатике (Python).

Твои правила:
- НИКОГДА не давай готовый правильный код и не называй прямой ответ
- Действуй как опытный учитель: веди ученика к пониманию через вопросы и наблюдения
- Если в коде небольшая ошибка — укажи конкретно, но не исправляй сам (например: "ты считаешь единицы, а задача просит нули")
- Если решение принципиально неверное — задавай наводящие вопросы: "какое значение просит найти задача?", "что именно находит твой код?", "какой результат ты получишь на примере из условия?"
- Иногда проверяй знание встроенных функций: "что делает функция set() с дубликатами?", "что возвращает int() от строки '10'?"
- Хвали за правильные части кода
- Если ученик не прислал код — вежливо попроси: "Поделись своим кодом, я посмотрю что не так"
- Анализируй эталонное решение (если есть) только для понимания задачи — не показывай его ученику
- Отвечай кратко: 2–4 предложения, один-два конкретных вопроса или наблюдения

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
    is_mentor = body.user_code is not None
    system_prompt = MENTOR_SYSTEM_PROMPT if is_mentor else SYSTEM_PROMPT
    messages = [{"role": "system", "content": system_prompt}]

    # Task context block
    task_context = f"Условие задачи:\n{task.content_html}"
    if is_mentor and task.full_solution_code:
        task_context += f"\n\nЭталонное решение (только для твоего анализа, не показывай ученику):\n```python\n{task.full_solution_code}\n```"
    messages.append({"role": "system", "content": task_context})

    for log in reversed(history):
        messages.append({"role": "user", "content": log.user_query})
        messages.append({"role": "assistant", "content": log.ai_response})

    # Include student code in current message if provided
    user_message = body.user_query
    if body.user_code:
        user_message = f"Мой код:\n```python\n{body.user_code}\n```\n\n{body.user_query}" if body.user_query else f"Мой код:\n```python\n{body.user_code}\n```"
    messages.append({"role": "user", "content": user_message})

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
