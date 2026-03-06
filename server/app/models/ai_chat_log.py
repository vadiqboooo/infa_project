"""AIChatLog — logs every AI-assistance interaction."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIMode(str, enum.Enum):
    tutorial = "tutorial"
    practice = "practice"


class AIChatLog(Base):
    __tablename__ = "ai_chat_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    mode: Mapped[AIMode] = mapped_column(Enum(AIMode), nullable=False, default=AIMode.tutorial)
    user_query: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_response: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # relationships
    user = relationship("User")
    task = relationship("Task")
