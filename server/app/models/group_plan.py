"""Lesson plan assigned to an existing student group."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GroupLesson(Base):
    __tablename__ = "group_lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    lesson_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    homework_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", server_default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    group = relationship("Group", back_populates="lessons")
    student = relationship("User")
    items = relationship("GroupLessonItem", back_populates="lesson", cascade="all, delete-orphan", order_by="GroupLessonItem.order_index", lazy="selectin")


class GroupLessonItem(Base):
    __tablename__ = "group_lesson_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("group_lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    section: Mapped[str] = mapped_column(String(20), nullable=False)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    lesson = relationship("GroupLesson", back_populates="items")
    topic = relationship("Topic")
    task = relationship("Task")

    __table_args__ = (
        CheckConstraint(
            "(topic_id IS NOT NULL AND task_id IS NULL) OR (topic_id IS NULL AND task_id IS NOT NULL)",
            name="ck_group_lesson_item_resource",
        ),
    )
