from pydantic import BaseModel
from datetime import datetime


class DayActivity(BaseModel):
    """Activity for a single day"""
    day: str  # 'Пн', 'Вт', etc.
    solved: int


class TopicPerformance(BaseModel):
    """Performance statistics for a topic"""
    name: str
    correct_count: int
    total_count: int
    accuracy: float  # percentage 0-100


class RecentActivity(BaseModel):
    """Recent task solution"""
    task_id: int
    task_title: str
    topic_name: str
    is_correct: bool
    solved_at: datetime


class StreakStats(BaseModel):
    """User streak statistics"""
    current_streak: int
    best_streak: int


class UserStats(BaseModel):
    """Overall user statistics"""
    total_solved: int
    total_tasks: int
    accuracy: float  # percentage 0-100
    predicted_score: int  # EGE score 0-100
    current_streak: int
    best_streak: int


class WeeklyActivity(BaseModel):
    """Weekly activity data"""
    days: list[DayActivity]


class TopicsPerformance(BaseModel):
    """Performance across all topics"""
    topics: list[TopicPerformance]


class RecentSolutions(BaseModel):
    """Recent solutions list"""
    solutions: list[RecentActivity]
