"""Exam model + many-to-many association with tasks."""

from sqlalchemy import Column, ForeignKey, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Association table for M2M relationship Exam <-> Task
exam_tasks = Table(
    "exam_tasks",
    Base.metadata,
    Column("exam_id", Integer, ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True),
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
)


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), nullable=False)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=60)

    # relationships
    topic = relationship("Topic", back_populates="exams")
    tasks = relationship("Task", secondary=exam_tasks, lazy="selectin")
