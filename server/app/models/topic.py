"""Topic model — grouping of tasks."""

from sqlalchemy import Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(50), default="tutorial", nullable=False)
    is_mock: Mapped[bool] = mapped_column(Integer, default=False, server_default="0", nullable=False)
    ege_number: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    ege_number_end: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    # ── Card image (stored in DB) ─────────────────────────────────
    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, default=None)
    image_mime: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    # 'cover' (top, full-width) | 'left' | 'right' | 'background'
    image_position: Mapped[str | None] = mapped_column(String(16), nullable=True, default=None)
    # height (cover) or side width (left/right) in px; ignored for background
    image_size: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    # relationships
    tasks = relationship(
        "Task",
        back_populates="topic",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="Task.order_index",
    )
    exams = relationship("Exam", back_populates="topic", lazy="selectin", cascade="all, delete-orphan")
