"""Topic model — grouping of tasks."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(50), default="tutorial", nullable=False)

    # relationships
    tasks = relationship(
        "Task",
        back_populates="topic",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Task.order_index",
    )
    exams = relationship("Exam", back_populates="topic", lazy="selectin", cascade="all, delete-orphan")
