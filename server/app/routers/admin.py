"""Admin router — CRUD for topics and tasks."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, verify_parser_api_key
from app.models.exam import Exam, exam_tasks
from app.models.task import AnswerType, Task
from app.models.topic import Topic
from app.models.user import User
from app.models.progress import UserProgress, ProgressStatus
from app.models.exam_attempt import ExamAttempt
from app.schemas.admin import (
    ImportVariantIn,
    ImportVariantResult,
    TaskAdminIn,
    TaskAdminOut,
    TopicIn,
    TopicOut,
    StudentOut,
    StudentTopicProgress,
    StudentExamScore,
    UserRoleUpdate,
)

router = APIRouter(
    tags=["admin"],
    dependencies=[Depends(verify_parser_api_key)],
)


# ── Topics ────────────────────────────────────────────────────

@router.get("/topics", response_model=list[TopicOut])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).order_by(Topic.order_index))
    topics = result.scalars().all()

    # Count tasks per topic
    counts_result = await db.execute(
        select(Task.topic_id, func.count(Task.id)).group_by(Task.topic_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}
    
    # Get exam time limits
    exams_result = await db.execute(select(Exam))
    exams = {e.topic_id: e.time_limit_minutes for e in exams_result.scalars().all()}

    return [
        TopicOut(
            id=t.id,
            title=t.title,
            order_index=t.order_index,
            category=t.category,
            task_count=counts.get(t.id, 0),
            time_limit_minutes=exams.get(t.id, 60),
            is_mock=t.is_mock,
        )
        for t in topics
    ]


@router.post("/topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic(body: TopicIn, db: AsyncSession = Depends(get_db)):
    topic = Topic(
        title=body.title, 
        order_index=body.order_index, 
        category=body.category,
        is_mock=body.is_mock
    )
    db.add(topic)
    await db.flush()
    
    # Create exam
    exam = Exam(topic_id=topic.id, time_limit_minutes=body.time_limit_minutes or 60)
    db.add(exam)
    
    await db.commit()
    await db.refresh(topic)
    return TopicOut(
        id=topic.id, 
        title=topic.title, 
        order_index=topic.order_index, 
        category=topic.category, 
        task_count=0,
        time_limit_minutes=exam.time_limit_minutes,
        is_mock=topic.is_mock
    )


@router.put("/topics/{topic_id}", response_model=TopicOut)
async def update_topic(topic_id: int, body: TopicIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    topic.title = body.title
    topic.order_index = body.order_index
    topic.category = body.category
    topic.is_mock = body.is_mock
    
    # Update exam
    exam_res = await db.execute(select(Exam).where(Exam.topic_id == topic_id))
    exam = exam_res.scalar_one_or_none()
    if exam:
        exam.time_limit_minutes = body.time_limit_minutes or 60
    else:
        exam = Exam(topic_id=topic_id, time_limit_minutes=body.time_limit_minutes or 60)
        db.add(exam)
        
    await db.commit()
    await db.refresh(topic)

    count_result = await db.execute(
        select(func.count(Task.id)).where(Task.topic_id == topic_id)
    )
    task_count = count_result.scalar() or 0
    return TopicOut(
        id=topic.id, 
        title=topic.title, 
        order_index=topic.order_index, 
        category=topic.category, 
        task_count=task_count,
        time_limit_minutes=exam.time_limit_minutes,
        is_mock=topic.is_mock
    )


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await db.delete(topic)
    await db.commit()


# ── Students ──────────────────────────────────────────────────

async def get_student_detail(user_id: int, db: AsyncSession) -> StudentOut:
    """Helper to get full student info for one user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get total tasks count
    tasks_count_res = await db.execute(select(func.count(Task.id)))
    total_tasks = tasks_count_res.scalar() or 0

    # Solved tasks total
    solved_total_result = await db.execute(
        select(func.count(UserProgress.id))
        .where(UserProgress.user_id == user.id, UserProgress.status == ProgressStatus.solved)
    )
    total_solved = solved_total_result.scalar() or 0

    # Solved tasks per topic
    topic_totals_query = await db.execute(
        select(Topic.id, Topic.title, func.count(Task.id))
        .join(Task, Task.topic_id == Topic.id)
        .group_by(Topic.id, Topic.title)
    )
    topic_totals = {row[0]: (row[1], row[2]) for row in topic_totals_query.all()}

    topic_solved_result = await db.execute(
        select(Task.topic_id, func.count(UserProgress.id))
        .join(UserProgress, UserProgress.task_id == Task.id)
        .where(UserProgress.user_id == user.id, UserProgress.status == ProgressStatus.solved)
        .group_by(Task.topic_id)
    )
    topic_solved = {row[0]: row[1] for row in topic_solved_result.all()}

    topic_progress = []
    for t_id, (t_title, t_total) in topic_totals.items():
        topic_progress.append(StudentTopicProgress(
            topic_name=t_title,
            solved=topic_solved.get(t_id, 0),
            total=t_total
        ))

    # Exam scores
    exams_result = await db.execute(
        select(ExamAttempt, Topic.title, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .join(Topic, Topic.id == Exam.topic_id)
        .where(ExamAttempt.user_id == user.id)
        .order_by(ExamAttempt.finished_at.desc())
    )
    
    exam_scores = []
    for row in exams_result.all():
        attempt, t_title, exam = row
        if attempt.score is not None:
            exam_scores.append(StudentExamScore(
                variant_name=t_title,
                score=attempt.score,
                max_score=len(exam.tasks) if exam.tasks else 0
            ))

    name = f"{user.first_name_real or ''} {user.last_name_real or ''}".strip() or user.first_name or f"User {user.id}"

    return StudentOut(
        id=user.id,
        name=name,
        username=user.username,
        photo_url=user.photo_url,
        role=user.role,
        last_active_at=user.last_active_at,
        total_solved=total_solved,
        total_tasks=total_tasks,
        exam_scores=exam_scores,
        topic_progress=topic_progress
    )


@router.get("/students", response_model=list[StudentOut])
async def list_students(db: AsyncSession = Depends(get_db)):
    """List all users with their statistics."""
    users_result = await db.execute(select(User).order_by(User.last_active_at.desc()))
    users = users_result.scalars().all()

    students = []
    for user in users:
        student = await get_student_detail(user.id, db)
        students.append(student)
    
    return students


@router.patch("/users/{user_id}/role", response_model=StudentOut)
async def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Change user role (student/admin)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if body.role not in ["student", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    user.role = body.role
    await db.commit()
    
    return await get_student_detail(user_id, db)


# ── Exams ─────────────────────────────────────────────────────

@router.get("/topics/{topic_id}/exam")
async def get_topic_exam(topic_id: int, db: AsyncSession = Depends(get_db)):
    """Get exam for a topic."""
    result = await db.execute(select(Exam).where(Exam.topic_id == topic_id))
    exam = result.scalar_one_or_none()
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return {"id": exam.id, "topic_id": exam.topic_id, "time_limit_minutes": exam.time_limit_minutes}


@router.put("/topics/{topic_id}/exam")
async def update_topic_exam(
    topic_id: int,
    time_limit_minutes: int,
    db: AsyncSession = Depends(get_db),
):
    """Update exam time limit for a topic."""
    result = await db.execute(select(Exam).where(Exam.topic_id == topic_id))
    exam = result.scalar_one_or_none()
    if exam is None:
        # Create exam if it doesn't exist
        exam = Exam(topic_id=topic_id, time_limit_minutes=time_limit_minutes)
        db.add(exam)
    else:
        exam.time_limit_minutes = time_limit_minutes
    await db.commit()
    await db.refresh(exam)
    return {"id": exam.id, "topic_id": exam.topic_id, "time_limit_minutes": exam.time_limit_minutes}


# ── Tasks ─────────────────────────────────────────────────────

@router.get("/tasks", response_model=list[TaskAdminOut])
async def list_tasks(topic_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Task)
    if topic_id is not None:
        query = query.where(Task.topic_id == topic_id)
    query = query.order_by(Task.order_index, Task.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tasks", response_model=TaskAdminOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskAdminIn, db: AsyncSession = Depends(get_db)):
    topic = await db.get(Topic, body.topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Получить максимальный order_index для этой темы
    max_order_result = await db.execute(
        select(func.max(Task.order_index)).where(Task.topic_id == body.topic_id)
    )
    max_order = max_order_result.scalar() or 0

    task = Task(
        topic_id=body.topic_id,
        external_id=body.external_id,
        ege_number=body.ege_number,
        title=body.title,
        description=body.description,
        content_html=body.content_html,
        media_resources=body.media_resources,
        answer_type=body.answer_type,
        difficulty=body.difficulty,
        correct_answer=body.correct_answer,
        solution_steps=body.solution_steps,
        full_solution_code=body.full_solution_code,
        order_index=max_order + 1,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskAdminOut)
async def update_task(task_id: int, body: TaskAdminIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Use a safer update pattern
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await db.delete(task)
    await db.commit()


@router.post("/tasks/{task_id}/move-up", status_code=status.HTTP_204_NO_CONTENT)
async def move_task_up(task_id: int, db: AsyncSession = Depends(get_db)):
    """Переместить задачу вверх (уменьшить order_index)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Найти предыдущую задачу в той же теме
    prev_result = await db.execute(
        select(Task)
        .where(Task.topic_id == task.topic_id, Task.order_index < task.order_index)
        .order_by(Task.order_index.desc())
        .limit(1)
    )
    prev_task = prev_result.scalar_one_or_none()

    if prev_task:
        # Поменять местами order_index
        task.order_index, prev_task.order_index = prev_task.order_index, task.order_index
        await db.commit()


@router.post("/tasks/{task_id}/move-down", status_code=status.HTTP_204_NO_CONTENT)
async def move_task_down(task_id: int, db: AsyncSession = Depends(get_db)):
    """Переместить задачу вниз (увеличить order_index)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Найти следующую задачу в той же теме
    next_result = await db.execute(
        select(Task)
        .where(Task.topic_id == task.topic_id, Task.order_index > task.order_index)
        .order_by(Task.order_index.asc())
        .limit(1)
    )
    next_task = next_result.scalar_one_or_none()

    if next_task:
        # Поменять местами order_index
        task.order_index, next_task.order_index = next_task.order_index, task.order_index
        await db.commit()


# ── Variant import ────────────────────────────────────────────

KOMPEGE_API = "https://kompege.ru/api/v1/variant/kim/{variant_id}"


def _parse_key(key: str, table: dict | None) -> tuple[AnswerType, dict | None]:
    """Parse kompege answer key into our (AnswerType, correct_answer) format."""
    cols, rows = 0, 0
    if table and isinstance(table, dict):
        try:
            cols = int(table.get("cols") or 0)
            rows = int(table.get("rows") or 0)
        except (ValueError, TypeError):
            pass

    key_str = str(key).strip()

    if "\n" in key_str or "\\n" in key_str:
        lines = key_str.replace("\\n", "\n").split("\n")
        grid: list[list[float]] = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            row_nums = []
            for p in line.replace(",", " ").split():
                try:
                    row_nums.append(float(p))
                except ValueError:
                    continue
            if row_nums:
                grid.append(row_nums)
        if grid:
            return AnswerType.table, {"val": grid}

    nums: list[float] = []
    for p in key_str.replace(",", " ").replace("\\n", " ").replace("\n", " ").split():
        try:
            nums.append(float(p))
        except ValueError:
            pass

    if not nums:
        if key_str and any(c.isalpha() for c in key_str):
            return AnswerType.text, {"val": key_str}
        return AnswerType.single_number, None

    total_cells = cols * rows
    if total_cells == 2 or (total_cells == 0 and len(nums) == 2):
        val = nums if len(nums) == 2 else None
        return AnswerType.pair, ({"val": val} if val else None)

    if total_cells > 2:
        grid_2d: list[list[float]] = []
        for r in range(rows):
            row = [nums[r * cols + c] if r * cols + c < len(nums) else 0.0 for c in range(cols)]
            grid_2d.append(row)
        return AnswerType.table, ({"val": grid_2d} if nums else None)

    return AnswerType.single_number, ({"val": nums[0]} if nums else None)


@router.post("/import-variant", response_model=ImportVariantResult, status_code=status.HTTP_201_CREATED)
async def import_variant(body: ImportVariantIn, db: AsyncSession = Depends(get_db)):
    """Fetch a variant from kompege.ru and create a topic with all its tasks."""
    url = KOMPEGE_API.format(variant_id=body.variant_id)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url)
        except httpx.RequestError as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Не удалось подключиться к kompege.ru: {e}")

    if resp.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Вариант {body.variant_id} не найден на kompege.ru")
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"kompege.ru вернул {resp.status_code}")

    data = resp.json()
    raw_tasks: list[dict] = data.get("tasks", [])
    if not raw_tasks:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Вариант не содержит задач")

    # Create topic
    title = body.topic_title or f"Вариант {body.variant_id}"
    topic = Topic(title=title, order_index=0, category="variants")
    db.add(topic)
    await db.flush()

    created = 0
    skipped = 0
    order_counter = 0

    for raw in sorted(raw_tasks, key=lambda t: int(t.get("number", 0) or 0)):
        content_html: str = raw.get("text", "").strip()
        if not content_html:
            skipped += 1
            continue

        key: str = str(raw.get("key", "")).strip()
        table = raw.get("table") or {}
        answer_type, correct_answer = _parse_key(key, table if isinstance(table, dict) else {})

        external_id = str(raw.get("taskId") or raw.get("id") or "")
        ege_number = raw.get("number")

        raw_files = raw.get("files") or []
        files = []
        for f in raw_files:
            url = str(f.get("url") or "").strip()
            if url:
                if url.startswith("/"):
                    url = "https://kompege.ru" + url
                files.append({"url": url, "name": str(f.get("name") or "")})
        media_resources = {"files": files} if files else None

        task = Task(
            topic_id=topic.id,
            external_id=external_id or None,
            ege_number=ege_number,
            order_index=order_counter,
            content_html=content_html,
            media_resources=media_resources,
            answer_type=answer_type,
            correct_answer=correct_answer,
        )
        db.add(task)
        created += 1
        order_counter += 1

    await db.commit()

    tasks_result = await db.execute(
        select(Task).where(Task.topic_id == topic.id)
    )
    tasks = list(tasks_result.scalars().all())

    exam = Exam(
        topic_id=topic.id,
        time_limit_minutes=body.time_limit_minutes if hasattr(body, 'time_limit_minutes') and body.time_limit_minutes else 235,
    )
    db.add(exam)
    await db.flush()

    if tasks:
        values = [{"exam_id": exam.id, "task_id": task.id} for task in tasks]
        await db.execute(exam_tasks.insert(), values)

    await db.commit()

    return ImportVariantResult(
        topic_id=topic.id,
        topic_title=title,
        created_count=created,
        skipped_count=skipped,
    )
