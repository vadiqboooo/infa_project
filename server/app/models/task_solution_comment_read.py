"""Per-user read state for task solution comment notifications."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserTaskSolutionCommentRead(Base):
    __tablename__ = "user_task_solution_comment_reads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("user_task_solution_comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    comment = relationship("UserTaskSolutionComment")

    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_user_task_solution_comment_read"),
    )
