"""Admin router — CRUD for topics and tasks."""

import json
import os
import re
import uuid
import httpx
from datetime import timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.dependencies import get_db, verify_parser_api_key
from app.models.exam import Exam, exam_tasks
from app.models.task import AnswerType, Task
from app.models.topic import Topic
from app.models.user import User
from app.models.progress import UserProgress, ProgressStatus
from app.models.exam_attempt import ExamAttempt
from app.models.exam_analysis import ExamAnalysis
from app.models.group import Group, user_groups
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
    StudentDetailOut,
    StudentTopicDetail,
    StudentTaskResult,
    TopicStatsOut,
    TopicStatsStudentRow,
    TopicStatsTaskInfo,
    GroupIn,
    GroupOut,
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
            ege_number=t.ege_number,
        )
        for t in topics
    ]


@router.post("/topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic(body: TopicIn, db: AsyncSession = Depends(get_db)):
    topic = Topic(
        title=body.title,
        order_index=body.order_index,
        category=body.category,
        is_mock=body.is_mock,
        ege_number=body.ege_number,
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
        is_mock=topic.is_mock,
        ege_number=topic.ege_number,
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
    topic.ege_number = body.ege_number
    
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
        is_mock=topic.is_mock,
        ege_number=topic.ege_number,
    )


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Collect task IDs belonging to this topic
    task_ids_result = await db.execute(select(Task.id).where(Task.topic_id == topic_id))
    task_ids = [row[0] for row in task_ids_result.all()]

    if task_ids:
        # Delete dependent records that reference these tasks
        from app.models.progress import UserProgress
        from app.models.ai_chat_log import AIChatLog
        await db.execute(
            UserProgress.__table__.delete().where(UserProgress.task_id.in_(task_ids))
        )
        await db.execute(
            AIChatLog.__table__.delete().where(AIChatLog.task_id.in_(task_ids))
        )

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

    # Group memberships
    groups_res = await db.execute(
        select(user_groups.c.group_id).where(user_groups.c.user_id == user.id)
    )
    group_ids = [row[0] for row in groups_res.all()]

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
        topic_progress=topic_progress,
        group_ids=group_ids,
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


@router.get("/students/{user_id}", response_model=StudentDetailOut)
async def get_student_detail_full(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get full per-task breakdown for a student, grouped by topic."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all topics with their tasks
    topics_result = await db.execute(
        select(Topic).order_by(Topic.category, Topic.order_index)
    )
    all_topics = topics_result.scalars().all()

    tasks_result = await db.execute(
        select(Task).order_by(Task.order_index, Task.id)
    )
    all_tasks = tasks_result.scalars().all()

    # Get all progress records for this user
    progress_result = await db.execute(
        select(UserProgress).where(UserProgress.user_id == user_id)
    )
    progress_map: dict[int, UserProgress] = {
        p.task_id: p for p in progress_result.scalars().all()
    }

    # Group tasks by topic
    tasks_by_topic: dict[int, list[Task]] = {}
    for task in all_tasks:
        tasks_by_topic.setdefault(task.topic_id, []).append(task)

    total_solved = sum(1 for p in progress_map.values() if p.status == ProgressStatus.solved)

    # Get all exams for topic->exam mapping
    all_exams_res = await db.execute(select(Exam))
    topic_exam_map: dict[int, int] = {e.topic_id: e.id for e in all_exams_res.scalars().all()}

    # Get latest finished attempt per exam for this user
    exam_ids = list(topic_exam_map.values())
    attempt_by_exam: dict[int, int] = {}
    if exam_ids:
        attempts_res = await db.execute(
            select(ExamAttempt)
            .where(
                ExamAttempt.user_id == user_id,
                ExamAttempt.exam_id.in_(exam_ids),
                ExamAttempt.finished_at.is_not(None),
            )
            .order_by(ExamAttempt.finished_at.desc())
        )
        for att in attempts_res.scalars().all():
            if att.exam_id not in attempt_by_exam:
                attempt_by_exam[att.exam_id] = att.id

    # Get which attempts have saved analysis
    attempt_ids_with_attempts = list(attempt_by_exam.values())
    analyzed_ids: set[int] = set()
    if attempt_ids_with_attempts:
        analysis_res = await db.execute(
            select(ExamAnalysis.attempt_id).where(
                ExamAnalysis.attempt_id.in_(attempt_ids_with_attempts)
            )
        )
        analyzed_ids = {row[0] for row in analysis_res.all()}

    topic_details = []
    for topic in all_topics:
        topic_tasks = tasks_by_topic.get(topic.id, [])
        if not topic_tasks:
            continue
        task_results = []
        for task in topic_tasks:
            prog = progress_map.get(task.id)
            task_results.append(StudentTaskResult(
                task_id=task.id,
                ege_number=task.ege_number,
                order_index=task.order_index,
                status=prog.status.value if prog else "not_started",
                attempts_count=prog.attempts_count if prog else 0,
            ))
        exam_id = topic_exam_map.get(topic.id)
        attempt_id = attempt_by_exam.get(exam_id) if exam_id else None
        topic_details.append(StudentTopicDetail(
            topic_id=topic.id,
            topic_name=topic.title,
            category=topic.category,
            attempt_id=attempt_id,
            has_analysis=attempt_id in analyzed_ids if attempt_id else False,
            tasks=task_results,
        ))

    name = f"{user.first_name_real or ''} {user.last_name_real or ''}".strip() or user.first_name or f"User {user.id}"

    return StudentDetailOut(
        id=user.id,
        name=name,
        username=user.username,
        photo_url=user.photo_url,
        role=user.role,
        last_active_at=user.last_active_at,
        total_solved=total_solved,
        total_tasks=len(all_tasks),
        topics=topic_details,
    )


@router.delete("/students/{user_id}/topics/{topic_id}/progress", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_topic_progress(user_id: int, topic_id: int, db: AsyncSession = Depends(get_db)):
    """Delete all UserProgress + ExamAttempts for a student on a topic so they can retake it."""
    task_ids_result = await db.execute(select(Task.id).where(Task.topic_id == topic_id))
    task_ids = [row[0] for row in task_ids_result.all()]

    if task_ids:
        await db.execute(
            UserProgress.__table__.delete().where(
                UserProgress.user_id == user_id,
                UserProgress.task_id.in_(task_ids),
            )
        )

    exam_result = await db.execute(select(Exam).where(Exam.topic_id == topic_id))
    exam = exam_result.scalar_one_or_none()
    if exam:
        await db.execute(
            ExamAttempt.__table__.delete().where(
                ExamAttempt.user_id == user_id,
                ExamAttempt.exam_id == exam.id,
            )
        )

    await db.commit()


# ── Groups ────────────────────────────────────────────────────

@router.get("/groups", response_model=list[GroupOut])
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).order_by(Group.name))
    groups = result.scalars().all()

    # Count members per group
    counts_res = await db.execute(
        select(user_groups.c.group_id, func.count(user_groups.c.user_id))
        .group_by(user_groups.c.group_id)
    )
    counts = {row[0]: row[1] for row in counts_res.all()}

    return [
        GroupOut(id=g.id, name=g.name, color=g.color, student_count=counts.get(g.id, 0))
        for g in groups
    ]


@router.post("/groups", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(body: GroupIn, db: AsyncSession = Depends(get_db)):
    group = Group(name=body.name.strip(), color=body.color)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return GroupOut(id=group.id, name=group.name, color=group.color, student_count=0)


@router.put("/groups/{group_id}", response_model=GroupOut)
async def update_group(group_id: int, body: GroupIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.name = body.name.strip()
    group.color = body.color
    await db.commit()
    # Count members
    cnt_res = await db.execute(
        select(func.count(user_groups.c.user_id)).where(user_groups.c.group_id == group_id)
    )
    cnt = cnt_res.scalar() or 0
    return GroupOut(id=group.id, name=group.name, color=group.color, student_count=cnt)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
    await db.commit()


@router.post("/groups/{group_id}/students/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_student_to_group(group_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    # Check both exist
    g = await db.execute(select(Group).where(Group.id == group_id))
    if not g.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")
    u = await db.execute(select(User).where(User.id == user_id))
    if not u.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    # Insert if not exists
    exists = await db.execute(
        select(user_groups).where(
            user_groups.c.user_id == user_id, user_groups.c.group_id == group_id
        )
    )
    if not exists.first():
        await db.execute(user_groups.insert().values(user_id=user_id, group_id=group_id))
        await db.commit()


@router.delete("/groups/{group_id}/students/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student_from_group(group_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(
        user_groups.delete().where(
            user_groups.c.user_id == user_id, user_groups.c.group_id == group_id
        )
    )
    await db.commit()


@router.get("/topics/{topic_id}/stats", response_model=TopicStatsOut)
async def get_topic_stats(topic_id: int, group_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Get a student×task matrix of results for a topic."""
    topic_result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = topic_result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    tasks_result = await db.execute(
        select(Task).where(Task.topic_id == topic_id).order_by(Task.order_index, Task.id)
    )
    tasks = tasks_result.scalars().all()
    if not tasks:
        return TopicStatsOut(topic_id=topic_id, topic_title=topic.title, tasks=[], students=[])

    task_ids = [t.id for t in tasks]

    # All progress records for these tasks
    progress_result = await db.execute(
        select(UserProgress).where(UserProgress.task_id.in_(task_ids))
    )
    all_progress = progress_result.scalars().all()

    # Unique user ids who have any interaction
    all_user_ids = list({p.user_id for p in all_progress})

    # Apply group filter if requested
    if group_id is not None:
        members_res = await db.execute(
            select(user_groups.c.user_id).where(user_groups.c.group_id == group_id)
        )
        member_ids = {row[0] for row in members_res.all()}
        user_ids = [uid for uid in all_user_ids if uid in member_ids]
    else:
        user_ids = all_user_ids

    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in users_result.scalars().all()}

    # Load all group memberships for these users
    if user_ids:
        groups_res = await db.execute(
            select(user_groups.c.user_id, user_groups.c.group_id)
            .where(user_groups.c.user_id.in_(user_ids))
        )
        groups_by_user: dict[int, list[int]] = {}
        for uid, gid in groups_res.all():
            groups_by_user.setdefault(uid, []).append(gid)
    else:
        groups_by_user = {}

    # Build per-user result map
    progress_by_user: dict[int, dict[int, str]] = {}
    for p in all_progress:
        progress_by_user.setdefault(p.user_id, {})[p.task_id] = p.status.value

    # Latest finished exam attempt per user (for AI analysis + student answers + timing)
    attempt_by_user: dict[int, int] = {}
    answers_by_user: dict[int, dict[int, any]] = {}
    timing_by_user: dict[int, dict] = {}
    exam_res2 = await db.execute(select(Exam).where(Exam.topic_id == topic_id))
    topic_exam = exam_res2.scalar_one_or_none()
    if topic_exam and user_ids:
        attempts_res = await db.execute(
            select(ExamAttempt)
            .where(
                ExamAttempt.exam_id == topic_exam.id,
                ExamAttempt.user_id.in_(user_ids),
                ExamAttempt.finished_at.is_not(None),
            )
            .order_by(ExamAttempt.finished_at.desc())
        )
        for att in attempts_res.scalars().all():
            if att.user_id not in attempt_by_user:
                attempt_by_user[att.user_id] = att.id
                # Extract user answers + solutions from results_json
                task_results = (att.results_json or {}).get("task_results", [])
                answers_by_user[att.user_id] = {
                    tr["task_id"]: {
                        "user_answer": tr.get("user_answer"),
                        "code_solution": tr.get("code_solution"),
                        "file_solution_url": tr.get("file_solution_url"),
                        "is_correct": tr.get("is_correct"),
                        "points": tr.get("points", 0),
                        "max_points": tr.get("max_points", 1),
                        "time_spent_seconds": tr.get("time_spent_seconds"),
                    }
                    for tr in task_results
                    if tr.get("user_answer") is not None
                        or tr.get("code_solution")
                        or tr.get("file_solution_url")
                }
                # Timing info — cap at exam time limit to avoid inflated durations
                # (finished_at is set server-side on submit, can be slightly after timer expiry)
                eff_finished = att.finished_at
                if att.started_at and att.finished_at and topic_exam:
                    limit_end = att.started_at + timedelta(minutes=topic_exam.time_limit_minutes)
                    if att.finished_at > limit_end:
                        eff_finished = limit_end
                duration = None
                if att.started_at and eff_finished:
                    duration = int((eff_finished - att.started_at).total_seconds() // 60)
                timing_by_user[att.user_id] = {
                    "started_at": att.started_at,
                    "finished_at": eff_finished,
                    "duration_minutes": duration,
                }

    student_rows = []
    for uid in user_ids:
        u = users.get(uid)
        if not u:
            continue
        name = f"{u.first_name_real or ''} {u.last_name_real or ''}".strip() or u.first_name or f"User {u.id}"
        timing = timing_by_user.get(uid, {})
        student_rows.append(TopicStatsStudentRow(
            student_id=uid,
            student_name=name,
            photo_url=u.photo_url,
            attempt_id=attempt_by_user.get(uid),
            group_ids=groups_by_user.get(uid, []),
            results=progress_by_user.get(uid, {}),
            answers=answers_by_user.get(uid, {}),
            exam_started_at=timing.get("started_at"),
            exam_finished_at=timing.get("finished_at"),
            exam_duration_minutes=timing.get("duration_minutes"),
        ))

    # Sort students by name
    student_rows.sort(key=lambda s: s.student_name)

    task_infos = [
        TopicStatsTaskInfo(task_id=t.id, ege_number=t.ege_number, order_index=t.order_index, correct_answer=t.correct_answer)
        for t in tasks
    ]

    return TopicStatsOut(
        topic_id=topic_id,
        topic_title=topic.title,
        tasks=task_infos,
        students=student_rows,
    )


@router.post("/attempts/{attempt_id}/analyze")
async def admin_analyze_attempt(attempt_id: int, db: AsyncSession = Depends(get_db)):
    """Admin: generate AI analysis for any student's exam attempt."""
    attempt_result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.id == attempt_id,
            ExamAttempt.finished_at.is_not(None),
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")

    results_json = attempt.results_json or {}
    task_results = results_json.get("task_results", [])
    if not task_results:
        raise HTTPException(status_code=400, detail="No task results in this attempt")

    task_ids = [tr["task_id"] for tr in task_results]
    tasks_res = await db.execute(select(Task).where(Task.id.in_(task_ids)))
    tasks_map: dict[int, Task] = {t.id: t for t in tasks_res.scalars().all()}

    import re as _re

    def _strip(html: str, limit: int = 500) -> str:
        text = _re.sub(r"<[^>]+>", " ", html)
        return _re.sub(r"\s+", " ", text).strip()[:limit]

    sorted_results = sorted(task_results, key=lambda r: (r.get("ege_number") or 99))
    correct = [r for r in sorted_results if r.get("is_correct")]
    wrong = [r for r in sorted_results if not r.get("is_correct") and r.get("points", 0) == 0]
    partial = [r for r in sorted_results if not r.get("is_correct") and r.get("points", 0) > 0]

    primary = attempt.primary_score or 0
    score = attempt.score or 0.0

    wrong_details: list[str] = []
    for r in wrong + partial:
        task = tasks_map.get(r["task_id"])
        num = r.get("ege_number") or "?"
        u_ans = r.get("user_answer")
        c_ans = r.get("correct_answer")
        user_val = u_ans.get("val") if u_ans else "не ответил"
        correct_val = c_ans.get("val") if c_ans else "?"
        pts = r.get("points", 0)
        max_pts = r.get("max_points", 1)
        detail = f"Задание №{num}: ответ = {user_val}, верный = {correct_val} ({pts}/{max_pts} балл.)"
        if task and task.content_html:
            detail += f"\nУсловие: {_strip(task.content_html)}"
        if task and task.full_solution_code:
            detail += f"\nЭталонный код:\n```python\n{task.full_solution_code[:500]}\n```"
        elif task and task.solution_steps and isinstance(task.solution_steps, list):
            expl = " ".join(s.get("explanation", "") for s in task.solution_steps[:2] if isinstance(s, dict))
            if expl:
                detail += f"\nПояснение: {expl[:300]}"
        wrong_details.append(detail)

    correct_nums = [str(r.get("ege_number") or "?") for r in correct]

    prompt = f"""Проанализируй результаты ЕГЭ по информатике ученика.

📊 Итог:
- Первичный балл: {primary}/29
- Тестовый балл: {score:.0f}/100
- Верно: {len(correct)} из {len(sorted_results)}
- Верные задания: {", ".join(correct_nums) if correct_nums else "нет"}

{"❌ Задания с ошибками:" if wrong_details else "✅ Все задания решены верно!"}
{chr(10).join(wrong_details)}

Напиши развёрнутый персональный анализ на русском языке:
1. 📈 **Краткое резюме** — оцени результат и уровень подготовки
2. ❌ **Разбор ошибок** — для каждого неверного задания: почему возникла ошибка, что нужно понять. Если есть код — объясни ключевую идею.
3. ✅ **Правильно решённые** — одно тёплое предложение с похвалой
4. 🎯 **Что повторить** — конкретные темы

Используй markdown (жирный, списки)."""

    import httpx as _httpx
    from app.config import settings as _settings

    try:
        async with _httpx.AsyncClient(timeout=120) as client:
            headers = {
                "Authorization": f"Bearer {_settings.LLM_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Edu Platform",
            }
            payload = {
                "model": _settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": "Ты опытный преподаватель информатики. Анализируешь работы учеников на ЕГЭ. Отвечай на русском языке."},
                    {"role": "user", "content": prompt},
                ],
            }
            resp = await client.post(f"{_settings.LLM_BASE_URL}/chat/completions", headers=headers, json=payload)
            if resp.status_code != 200:
                err_body = resp.text[:500]
                import logging as _log
                _log.getLogger(__name__).error("LLM error %s: %s", resp.status_code, err_body)
                raise HTTPException(status_code=502, detail=f"LLM error {resp.status_code}: {err_body}")
            analysis = resp.json()["choices"][0]["message"]["content"]
    except _httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Save / overwrite in DB
    existing_res = await db.execute(
        select(ExamAnalysis).where(ExamAnalysis.attempt_id == attempt_id)
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        existing.analysis_text = analysis
    else:
        db.add(ExamAnalysis(attempt_id=attempt_id, analysis_text=analysis))
    await db.commit()

    return {"analysis": analysis}


@router.get("/attempts/{attempt_id}/analyze")
async def get_attempt_analysis(attempt_id: int, db: AsyncSession = Depends(get_db)):
    """Return saved AI analysis for an attempt, or 404 if not yet generated."""
    result = await db.execute(
        select(ExamAnalysis).where(ExamAnalysis.attempt_id == attempt_id)
    )
    rec = result.scalar_one_or_none()
    if rec is None:
        raise HTTPException(status_code=404, detail="No analysis found")
    return {"analysis": rec.analysis_text, "created_at": rec.created_at}


@router.get("/attempts/{attempt_id}/results")
async def get_attempt_results(attempt_id: int, db: AsyncSession = Depends(get_db)):
    """Return structured task results for an attempt (student answers, correct answers, solutions)."""
    attempt = await db.get(ExamAttempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    task_results = (attempt.results_json or {}).get("task_results", [])
    return {
        "attempt_id": attempt_id,
        "primary_score": attempt.primary_score,
        "score": attempt.score,
        "task_results": task_results,
    }


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


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

os.makedirs("uploads/step_images", exist_ok=True)


@router.post("/tasks/{task_id}/steps/{step_index}/upload-image")
async def upload_step_image(
    task_id: int,
    step_index: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image for a specific solution step and attach its URL to the step."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type not allowed")

    file_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = Path(f"uploads/step_images/{file_name}")
    file_path.write_bytes(await file.read())
    url = f"/uploads/step_images/{file_name}"

    # Attach URL to the step's images list
    steps = list(task.solution_steps or [])
    if step_index < 0 or step_index >= len(steps):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step index")

    step = dict(steps[step_index])
    imgs = list(step.get("images") or [])
    imgs.append(url)
    step["images"] = imgs
    steps[step_index] = step
    task.solution_steps = steps
    flag_modified(task, "solution_steps")
    await db.commit()

    return {"url": url}


@router.delete("/tasks/{task_id}/steps/{step_index}/images")
async def delete_step_image(
    task_id: int,
    step_index: int,
    url: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove an image URL from a solution step (and delete file)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    steps = list(task.solution_steps or [])
    if step_index < 0 or step_index >= len(steps):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step index")

    step = dict(steps[step_index])
    imgs = [i for i in (step.get("images") or []) if i != url]
    step["images"] = imgs
    steps[step_index] = step
    task.solution_steps = steps
    flag_modified(task, "solution_steps")
    await db.commit()

    # Try to delete the file
    if url.startswith("/uploads/step_images/"):
        file_path = Path(url.lstrip("/"))
        if file_path.exists():
            file_path.unlink(missing_ok=True)

    return {"ok": True}


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


# ── AI Step Generation ────────────────────────────────────────────

_STEP_SYSTEM_PROMPT = """Ты — эксперт-педагог по ЕГЭ информатике (Python).
Создаёшь пошаговые разборы задач для учеников.

Правила построения шагов:
1. НЕ повторяй условие задачи в объяснениях — ученик его уже видит.
2. Разбей на 3–6 логических шагов (анализ, теория, алгоритм, код, проверка).
3. Первый шаг — краткая теория/ключевая идея (1–2 предложения), которая нужна для решения.
4. Каждый шаг содержит:
   - title: короткий заголовок с эмодзи (например "📌 Ключевая идея", "🔍 Анализ условия", "🧮 Алгоритм", "💻 Код решения", "✅ Проверка")
   - explanation: объяснение в Markdown — используй **жирный** для важных терминов/чисел, маркированные списки (- пункт) для перечислений, > цитату для важных замечаний. Пиши коротко и по делу, без воды.
   - code: Python-код только этого шага (пустая строка если кода нет)
5. Код в шагах — только нужный фрагмент, финальный полный код — в последнем шаге.
6. Не используй заголовки Markdown (#, ##) внутри explanation — только списки, жирный, цитаты.

Верни ТОЛЬКО JSON-массив без лишнего текста:
[{"title":"📌 ...","explanation":"...","code":"..."},...]"""


@router.post("/tasks/{task_id}/generate-steps")
async def generate_solution_steps(task_id: int, db: AsyncSession = Depends(get_db)):
    """Use LLM with few-shot examples to generate solution_steps for a task."""
    from app.config import settings

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Fetch up to 3 example tasks that have solution_steps, prefer same ege_number
    q = select(Task).where(
        Task.solution_steps.is_not(None),
        Task.id != task_id,
    )
    if task.ege_number:
        # Try same ege_number first
        same_q = q.where(Task.ege_number == task.ege_number).limit(3)
        same_res = await db.execute(same_q)
        examples = same_res.scalars().all()
        if len(examples) < 2:
            # Pad with any other examples
            extra_q = q.where(Task.ege_number != task.ege_number).limit(3 - len(examples))
            extra_res = await db.execute(extra_q)
            examples = list(examples) + list(extra_res.scalars().all())
    else:
        any_res = await db.execute(q.limit(3))
        examples = any_res.scalars().all()

    if not examples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет задач с готовыми шагами решения для обучения. Сначала создайте хотя бы одно пошаговое решение вручную.",
        )

    # Build few-shot conversation
    messages: list[dict] = [{"role": "system", "content": _STEP_SYSTEM_PROMPT}]

    for ex in examples[:3]:
        user_msg = f"Условие задачи:\n{ex.content_html}"
        if ex.full_solution_code:
            user_msg += f"\n\nКод решения:\n```python\n{ex.full_solution_code}\n```"
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": json.dumps(ex.solution_steps, ensure_ascii=False)})

    # Target task
    target_msg = f"Условие задачи:\n{task.content_html}"
    if task.full_solution_code:
        target_msg += f"\n\nКод решения:\n```python\n{task.full_solution_code}\n```"
    target_msg += "\n\nСоздай пошаговое решение. Верни ТОЛЬКО JSON-массив."
    messages.append({"role": "user", "content": target_msg})

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            headers = {
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Edu Platform",
            }
            resp = await client.post(
                f"{settings.LLM_BASE_URL}/chat/completions",
                headers=headers,
                json={"model": settings.LLM_MODEL, "messages": messages},
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM error: {resp.text}")

            ai_text = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if model wrapped the JSON
        ai_text = re.sub(r"^```[a-z]*\n?", "", ai_text)
        ai_text = re.sub(r"\n?```$", "", ai_text).strip()

        steps = json.loads(ai_text)
        if not isinstance(steps, list):
            raise ValueError("Expected JSON array")

        # Normalise — ensure required fields
        clean = []
        for s in steps:
            clean.append({
                "title": str(s.get("title", "")),
                "explanation": str(s.get("explanation", "")),
                "code": str(s.get("code", "")),
            })

        return {"steps": clean, "examples_used": len(examples)}

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Не удалось разобрать ответ LLM как JSON: {exc}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
