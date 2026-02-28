"""Task model — individual problem / exercise."""

import enum

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AnswerType(str, enum.Enum):
    single_number = "single_number"
    pair = "pair"
    table = "table"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    content_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    media_resources: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    answer_type: Mapped[AnswerType] = mapped_column(Enum(AnswerType), nullable=False, default=AnswerType.single_number)
    correct_answer: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # relationships
    topic = relationship("Topic", back_populates="tasks")

    __table_args__ = (
        Index("ix_tasks_external_id", "external_id"),
    )
