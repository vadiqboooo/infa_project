"""Admin comments attached to selected ranges in a student's task solution."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserTaskSolutionComment(Base):
    __tablename__ = "user_task_solution_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    solution_id: Mapped[int] = mapped_column(
        ForeignKey("user_task_solutions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    from_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    to_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    from_line: Mapped[int] = mapped_column(Integer, nullable=False)
    from_col: Mapped[int] = mapped_column(Integer, nullable=False)
    to_line: Mapped[int] = mapped_column(Integer, nullable=False)
    to_col: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    solution = relationship("UserTaskSolution", back_populates="comments")
    author = relationship("User")
