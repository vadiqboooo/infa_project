"""Snapshots of a student's attached task solution."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserTaskSolutionVersion(Base):
    __tablename__ = "user_task_solution_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    solution_id: Mapped[int] = mapped_column(
        ForeignKey("user_task_solutions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    change_type: Mapped[str] = mapped_column(String(32), nullable=False, default="code")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    solution = relationship("UserTaskSolution", back_populates="versions")
