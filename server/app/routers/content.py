"""Content router — navigation tree, task details, admin sync."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
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


@router.get("/topics/{topic_id}/image")
async def get_topic_image(topic_id: int, db: AsyncSession = Depends(get_db)):
    """Serve raw bytes of topic card image. Public — needed for <img src>."""
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None or topic.image_data is None:
        raise HTTPException(status_code=404, detail="No image")
    return Response(
        content=topic.image_data,
        media_type=topic.image_mime or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=3600"},
    )


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

    # EGE primary→test conversion table (0–29 → 0–100)
    EGE_SCORE_MAP = [0, 7, 14, 20, 27, 34, 40, 43, 46, 48, 51, 54, 56, 59, 62, 64,
                     67, 70, 72, 75, 78, 80, 83, 85, 88, 90, 93, 95, 98, 100]

    def _primary_to_test(primary: int) -> float:
        return float(EGE_SCORE_MAP[max(0, min(29, primary))])

    # Map topic_id -> latest attempt data
    latest_attempts: dict[int, dict] = {}
    # Map topic_id -> draft answers count from active (unfinished) attempts
    active_draft_counts: dict[int, int] = {}
    # Map topic_id -> {primary, score} from active attempt's scored answers
    active_scores: dict[int, dict] = {}
    for attempt, exam in attempts_query.all():
        if attempt.finished_at is None:
            # Active attempt — count draft answers and compute current score
            results = attempt.results_json or {}
            drafts = results.get("draft_answers", {})
            non_empty = sum(1 for v in drafts.values() if v and v.get("val") not in (None, "", []))
            active_draft_counts[exam.topic_id] = non_empty

            scored = results.get("scored_answers", {})
            current_primary = sum(int(s.get("points") or 0) for s in scored.values()) if scored else 0
            active_scores[exam.topic_id] = {
                "primary": current_primary,
                "score": _primary_to_test(current_primary),
            }
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

    def _compute_ege_max(t) -> int | None:
        """For composite tasks (with sub_tasks), return max number across main + subs."""
        if not t.sub_tasks:
            return None
        nums = []
        if isinstance(t.ege_number, int):
            nums.append(t.ege_number)
        for sub in t.sub_tasks:
            if isinstance(sub, dict):
                n = sub.get("number")
                if isinstance(n, int):
                    nums.append(n)
        return max(nums) if len(nums) >= 2 else None

    nav: list[TopicNav] = []
    for topic in topics:
        tasks_nav = [
            TaskNav(
                id=t.id,
                external_id=t.external_id,
                ege_number=t.ege_number,
                ege_number_max=_compute_ege_max(t),
                status=progress_map.get(t.id, "not_started"),
                has_solution=bool(t.solution_steps and len(t.solution_steps) > 0),
            )
            for t in topic.tasks
        ]
        
        exam = all_exams.get(topic.id)
        latest_attempt = latest_attempts.get(topic.id, {})
        active = active_scores.get(topic.id, {})

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
            current_score=active.get("score"),
            current_primary_score=active.get("primary"),
            max_score=len(exam.tasks) if exam and exam.tasks else len(topic.tasks),
            time_limit_minutes=exam.time_limit_minutes if exam else 60,
            is_mock=topic.is_mock,
            ege_number=topic.ege_number,
            ege_number_end=topic.ege_number_end,
            analysis_published=attempt_id in published_ids if attempt_id else False,
            draft_count=active_draft_counts.get(topic.id, 0),
            has_image=topic.image_data is not None,
            image_position=topic.image_position,
            image_size=topic.image_size,
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
