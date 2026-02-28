"""Admin router — CRUD for topics and tasks."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, verify_parser_api_key
from app.models.task import AnswerType, Task
from app.models.topic import Topic
from app.schemas.admin import (
    ImportVariantIn,
    ImportVariantResult,
    TaskAdminIn,
    TaskAdminOut,
    TopicIn,
    TopicOut,
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

    return [
        TopicOut(
            id=t.id,
            title=t.title,
            order_index=t.order_index,
            task_count=counts.get(t.id, 0),
        )
        for t in topics
    ]


@router.post("/topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic(body: TopicIn, db: AsyncSession = Depends(get_db)):
    topic = Topic(title=body.title, order_index=body.order_index)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return TopicOut(id=topic.id, title=topic.title, order_index=topic.order_index, task_count=0)


@router.put("/topics/{topic_id}", response_model=TopicOut)
async def update_topic(topic_id: int, body: TopicIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    topic.title = body.title
    topic.order_index = body.order_index
    await db.commit()
    await db.refresh(topic)

    count_result = await db.execute(
        select(func.count(Task.id)).where(Task.topic_id == topic_id)
    )
    task_count = count_result.scalar() or 0
    return TopicOut(id=topic.id, title=topic.title, order_index=topic.order_index, task_count=task_count)


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await db.delete(topic)
    await db.commit()


# ── Tasks ─────────────────────────────────────────────────────

@router.get("/tasks", response_model=list[TaskAdminOut])
async def list_tasks(topic_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Task)
    if topic_id is not None:
        query = query.where(Task.topic_id == topic_id)
    query = query.order_by(Task.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tasks", response_model=TaskAdminOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskAdminIn, db: AsyncSession = Depends(get_db)):
    topic = await db.get(Topic, body.topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    task = Task(
        topic_id=body.topic_id,
        external_id=body.external_id,
        content_html=body.content_html,
        media_resources=body.media_resources,
        answer_type=body.answer_type,
        correct_answer=body.correct_answer,
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.topic_id = body.topic_id
    task.external_id = body.external_id
    task.content_html = body.content_html
    task.media_resources = body.media_resources
    task.answer_type = body.answer_type
    task.correct_answer = body.correct_answer
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await db.delete(task)
    await db.commit()


# ── Variant import ────────────────────────────────────────────

KOMPEGE_API = "https://kompege.ru/api/v1/variant/kim/{variant_id}"


def _parse_key(key: str, table: dict | None) -> tuple[AnswerType, dict | None]:
    """Parse kompege answer key into our (AnswerType, correct_answer) format.

    table field from kompege: {"cols": N, "rows": M} — describes input grid size.
    key field: space-separated numbers, e.g. "5" / "3 4" / "1 2 3 4"
    """
    cols, rows = 0, 0
    if table and isinstance(table, dict):
        try:
            cols = int(table.get("cols") or 0)
            rows = int(table.get("rows") or 0)
        except (ValueError, TypeError):
            pass

    # Parse numbers from key
    nums: list[float] = []
    for p in str(key).strip().replace(",", " ").split():
        try:
            nums.append(float(p))
        except ValueError:
            pass

    total_cells = cols * rows

    # Determine type by table metadata first, fallback to key length
    if total_cells == 2 or (total_cells == 0 and len(nums) == 2):
        val = nums if len(nums) == 2 else None
        return AnswerType.pair, ({"val": val} if val else None)

    if total_cells > 2:
        # Reshape nums into rows × cols 2D grid
        grid: list[list[float]] = []
        for r in range(rows):
            row = [nums[r * cols + c] if r * cols + c < len(nums) else 0.0 for c in range(cols)]
            grid.append(row)
        return AnswerType.table, ({"val": grid} if nums else None)

    # single_number (total_cells == 1 or 0 with 0-1 nums)
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
    topic = Topic(title=title, order_index=0)
    db.add(topic)
    await db.flush()  # get topic.id without committing

    created = 0
    skipped = 0

    for raw in sorted(raw_tasks, key=lambda t: t.get("number", 0)):
        content_html: str = raw.get("text", "").strip()
        if not content_html:
            skipped += 1
            continue

        key: str = str(raw.get("key", "")).strip()
        table = raw.get("table") or {}
        answer_type, correct_answer = _parse_key(key, table if isinstance(table, dict) else {})

        external_id = str(raw.get("taskId") or raw.get("id") or "")

        # Collect downloadable files
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
            content_html=content_html,
            media_resources=media_resources,
            answer_type=answer_type,
            correct_answer=correct_answer,
        )
        db.add(task)
        created += 1

    await db.commit()

    return ImportVariantResult(
        topic_id=topic.id,
        topic_title=title,
        created_count=created,
        skipped_count=skipped,
    )
