"""Configurable task-number structure for an exam and subject."""

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExamSubjectSettings(Base):
    __tablename__ = "exam_subject_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_type: Mapped[str] = mapped_column(String(10), nullable=False)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    task_names: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    __table_args__ = (
        UniqueConstraint("exam_type", "subject", name="uq_exam_subject_settings_pair"),
    )
