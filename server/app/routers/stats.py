from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..models.progress import UserProgress
from ..models.task import Task
from ..models.topic import Topic
from ..schemas.stats import (
    WeeklyActivity,
    TopicsPerformance,
    RecentSolutions,
    UserStats,
    DayActivity,
    TopicPerformance,
    RecentActivity,
)

router = APIRouter(prefix="/stats", tags=["statistics"])


def get_russian_weekday(weekday: int) -> str:
    """Convert weekday number to Russian abbreviation"""
    days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    return days[weekday]


@router.get("/overview", response_model=UserStats)
async def get_user_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get overall user statistics"""

    # Total tasks
    total_tasks_query = select(func.count(Task.id))
    result = await db.execute(total_tasks_query)
    total_tasks = result.scalar() or 0

    # Solved count
    solved_query = select(func.count(UserProgress.id)).where(
        and_(
            UserProgress.user_id == user.id,
            UserProgress.status == "solved"
        )
    )
    result = await db.execute(solved_query)
    total_solved = result.scalar() or 0

    # Accuracy calculation
    attempts_query = select(
        func.count(UserProgress.id).label("total"),
        func.sum(case((UserProgress.status == "solved", 1), else_=0)).label("correct")
    ).where(UserProgress.user_id == user.id)

    result = await db.execute(attempts_query)
    row = result.first()
    total_attempts = row.total or 0 if row else 0
    correct_attempts = row.correct or 0 if row else 0
    accuracy = (correct_attempts / total_attempts * 100) if total_attempts > 0 else 0

    # Streak calculation
    streak_query = select(
        func.date(UserProgress.last_attempt_at).label("d")
    ).where(
        and_(
            UserProgress.user_id == user.id,
            UserProgress.status == "solved"
        )
    ).group_by(func.date(UserProgress.last_attempt_at)).order_by(func.date(UserProgress.last_attempt_at).desc())

    result = await db.execute(streak_query)
    dates = [row[0] for row in result.all()]

    current_streak = 0
    best_streak = 0
    temp_streak = 0

    if dates:
        today = datetime.now().date()
        # Check current streak
        for i, date in enumerate(dates):
            expected_date = today - timedelta(days=i)
            if date == expected_date:
                current_streak += 1
            else:
                break

        # Calculate best streak
        if len(dates) > 0:
            temp_streak = 1
            for i in range(1, len(dates)):
                if (dates[i-1] - dates[i]).days == 1:
                    temp_streak += 1
                    best_streak = max(best_streak, temp_streak)
                else:
                    temp_streak = 1
            best_streak = max(best_streak, temp_streak, current_streak)

    # Predicted score calculation
    predicted_score = min(100, int(accuracy * 0.95))

    return UserStats(
        total_solved=total_solved,
        total_tasks=total_tasks,
        accuracy=round(accuracy, 1),
        predicted_score=predicted_score,
        current_streak=current_streak,
        best_streak=best_streak,
    )


@router.get("/weekly-activity", response_model=WeeklyActivity)
async def get_weekly_activity(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get activity for the last 7 days"""

    today = datetime.now().date()
    week_ago = today - timedelta(days=6)

    # Initialize all days with 0
    activity_by_day = {i: 0 for i in range(7)}

    # Query solved tasks in the last 7 days
    query = select(
        func.date(UserProgress.last_attempt_at).label("date"),
        func.count(UserProgress.id).label("count")
    ).where(
        and_(
            UserProgress.user_id == user.id,
            UserProgress.status == "solved",
            func.date(UserProgress.last_attempt_at) >= week_ago,
            func.date(UserProgress.last_attempt_at) <= today
        )
    ).group_by(func.date(UserProgress.last_attempt_at))

    result = await db.execute(query)
    results = result.all()

    for date, count in results:
        days_ago = (today - date).days
        if 0 <= days_ago < 7:
            activity_by_day[6 - days_ago] = count

    # Create day activities with Russian weekday names
    days_data = []
    for i in range(7):
        day_date = week_ago + timedelta(days=i)
        weekday = day_date.weekday()
        days_data.append(
            DayActivity(
                day=get_russian_weekday(weekday),
                solved=activity_by_day[i]
            )
        )

    return WeeklyActivity(days=days_data)


@router.get("/topics-performance", response_model=TopicsPerformance)
async def get_topics_performance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get performance statistics by topic"""

    # Query all topics with their task counts and user progress
    query = select(
        Topic.title,
        func.count(distinct(Task.id)).label("total_tasks"),
        func.sum(
            case(
                (
                    and_(
                        UserProgress.user_id == user.id,
                        UserProgress.status == "solved"
                    ),
                    1
                ),
                else_=0
            )
        ).label("solved_tasks")
    ).select_from(Topic).join(
        Task, Task.topic_id == Topic.id
    ).outerjoin(
        UserProgress,
        and_(
            UserProgress.task_id == Task.id,
            UserProgress.user_id == user.id
        )
    ).where(
        Topic.category == "tutorial"
    ).group_by(Topic.id, Topic.title)

    result = await db.execute(query)
    results = result.all()

    topics = []
    for title, total, solved in results:
        solved_count = solved or 0
        total_count = total or 0
        accuracy = (solved_count / total_count * 100) if total_count > 0 else 0

        topics.append(
            TopicPerformance(
                name=title[:15] if len(title) > 15 else title,
                correct_count=solved_count,
                total_count=total_count,
                accuracy=round(accuracy, 1)
            )
        )

    # Sort by accuracy descending
    topics.sort(key=lambda x: x.accuracy, reverse=True)

    return TopicsPerformance(topics=topics[:6])


@router.get("/recent-solutions", response_model=RecentSolutions)
async def get_recent_solutions(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent task solutions"""

    query = select(
        UserProgress.task_id,
        Task.content_html,
        Topic.title,
        UserProgress.status,
        UserProgress.last_attempt_at
    ).select_from(UserProgress).join(
        Task, Task.id == UserProgress.task_id
    ).join(
        Topic, Topic.id == Task.topic_id
    ).where(
        UserProgress.user_id == user.id
    ).order_by(
        UserProgress.last_attempt_at.desc()
    ).limit(limit)

    result = await db.execute(query)
    results = result.all()

    solutions = []
    for task_id, content_html, topic_title, status, solved_at in results:
        # Extract title from HTML content
        import re
        text = re.sub('<[^<]+?>', '', content_html)
        task_title = text[:50].strip() + "..." if len(text) > 50 else text.strip()

        solutions.append(
            RecentActivity(
                task_id=task_id,
                task_title=task_title,
                topic_name=topic_title,
                is_correct=(status == "solved"),
                solved_at=solved_at
            )
        )

    return RecentSolutions(solutions=solutions)
