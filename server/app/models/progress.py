"""UserProgress model — tracks solve status per user/task pair."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProgressStatus(str, enum.Enum):
    not_started = "not_started"
    solved = "solved"
    failed = "failed"


class UserProgress(Base):
    __tablename__ = "user_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ProgressStatus] = mapped_column(
        Enum(ProgressStatus), nullable=False, default=ProgressStatus.not_started,
    )
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    user = relationship("User")
    task = relationship("Task")

    __table_args__ = (
        UniqueConstraint("user_id", "task_id", name="uq_user_task"),
    )
