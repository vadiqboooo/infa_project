"""Content router — navigation tree, task details, admin sync."""

import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db, verify_parser_api_key
from app.models.task import Task
from app.models.topic import Topic
from app.models.topic_seen import UserTopicSeen
from app.models.user import User
from app.models.progress import UserProgress
from app.models.task_solution import UserTaskSolution
from app.models.task_solution_comment import UserTaskSolutionComment
from app.schemas.navigation import TaskNav, TopicNav
from app.schemas.task import TaskOut, TaskSyncIn, TaskSyncResult

router = APIRouter(tags=["content"])


class SeenTopicsIn(BaseModel):
    topic_ids: list[int]


@router.get("/topics/{topic_id}/image")
async def get_topic_image(
    topic_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Serve raw bytes of topic card image. Public — needed for <img src>.

    Uses ETag-based revalidation so admins see updated images immediately
    after replacing them, while still avoiding redundant downloads for
    unchanged content.
    """
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None or topic.image_data is None:
        raise HTTPException(status_code=404, detail="No image")

    etag = '"' + hashlib.md5(topic.image_data).hexdigest()[:16] + '"'

    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=304,
            headers={"ETag": etag, "Cache-Control": "no-cache, must-revalidate"},
        )

    return Response(
        content=topic.image_data,
        media_type=topic.image_mime or "application/octet-stream",
        headers={
            "ETag": etag,
            "Cache-Control": "no-cache, must-revalidate",
        },
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

    seen_result = await db.execute(
        select(UserTopicSeen).where(UserTopicSeen.user_id == user.id)
    )
    seen_by_topic: dict[int, UserTopicSeen] = {
        row.topic_id: row for row in seen_result.scalars().all()
    }
    seen_changed = False

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
        current_task_count = len(topic.tasks)
        seen = seen_by_topic.get(topic.id)
        if seen is None:
            seen = UserTopicSeen(
                user_id=user.id,
                topic_id=topic.id,
                seen_task_count=current_task_count,
            )
            db.add(seen)
            seen_changed = True
            new_tasks_count = 0
        elif current_task_count < seen.seen_task_count:
            seen.seen_task_count = current_task_count
            seen_changed = True
            new_tasks_count = 0
        else:
            new_tasks_count = current_task_count - seen.seen_task_count

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
            new_tasks_count=new_tasks_count,
            has_image=topic.image_data is not None,
            image_position=topic.image_position,
            image_size=topic.image_size,
            character_url=topic.character_url,
            background_url=topic.background_url,
        ))
    if seen_changed:
        await db.commit()
    return nav


@router.post("/navigation/seen-topics")
async def mark_seen_topics(
    body: SeenTopicsIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark current task counts for topics as seen by the current user."""
    topic_ids = sorted({int(tid) for tid in body.topic_ids if int(tid) > 0})
    if not topic_ids:
        return {"updated": 0}

    result = await db.execute(
        select(Topic).options(selectinload(Topic.tasks)).where(Topic.id.in_(topic_ids))
    )
    topics = result.scalars().unique().all()
    if not topics:
        return {"updated": 0}

    seen_result = await db.execute(
        select(UserTopicSeen).where(
            UserTopicSeen.user_id == user.id,
            UserTopicSeen.topic_id.in_([topic.id for topic in topics]),
        )
    )
    seen_by_topic = {row.topic_id: row for row in seen_result.scalars().all()}

    updated = 0
    for topic in topics:
        current_task_count = len(topic.tasks)
        seen = seen_by_topic.get(topic.id)
        if seen is None:
            db.add(UserTopicSeen(
                user_id=user.id,
                topic_id=topic.id,
                seen_task_count=current_task_count,
            ))
            updated += 1
        elif seen.seen_task_count != current_task_count:
            seen.seen_task_count = current_task_count
            updated += 1

    await db.commit()
    return {"updated": updated}


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return task details (HTML content, media, answer type)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    solution_result = await db.execute(
        select(UserTaskSolution).where(
            UserTaskSolution.user_id == user.id,
            UserTaskSolution.task_id == task_id,
        )
    )
    solution = solution_result.scalar_one_or_none()
    comments_count = 0
    if solution is not None:
        comments_result = await db.execute(
            select(func.count(UserTaskSolutionComment.id)).where(
                UserTaskSolutionComment.solution_id == solution.id,
            )
        )
        comments_count = int(comments_result.scalar_one() or 0)

    return TaskOut(
        id=task.id,
        topic_id=task.topic_id,
        external_id=task.external_id,
        ege_number=task.ege_number,
        title=task.title,
        description=task.description,
        content_html=task.content_html,
        media_resources=task.media_resources,
        answer_type=task.answer_type,
        difficulty=task.difficulty,
        solution_steps=task.solution_steps,
        full_solution_code=task.full_solution_code,
        sub_tasks=task.sub_tasks,
        has_own_solution=bool(solution and (solution.code or solution.file_url or solution.image_url)),
        solution_comments_count=comments_count,
    )


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
