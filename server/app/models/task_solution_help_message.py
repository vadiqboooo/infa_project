"""Messages inside a task-solution help dialogue."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserTaskSolutionHelpMessage(Base):
    __tablename__ = "user_task_solution_help_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    help_request_id: Mapped[int] = mapped_column(
        ForeignKey("user_task_solution_help_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_role: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="text", server_default="text")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    help_request = relationship("UserTaskSolutionHelpRequest")
    author = relationship("User")
