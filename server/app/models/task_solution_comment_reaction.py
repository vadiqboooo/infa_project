"""Student reaction to a teacher comment on a task solution."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserTaskSolutionCommentReaction(Base):
    __tablename__ = "user_task_solution_comment_reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("user_task_solution_comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reaction: Mapped[str] = mapped_column(String(32), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User")
    comment = relationship("UserTaskSolutionComment")

    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_user_task_solution_comment_reaction"),
    )
