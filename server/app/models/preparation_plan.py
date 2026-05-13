"""Preparation plan models for guided EGE study routes."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PreparationPlan(Base):
    __tablename__ = "preparation_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    course_type: Mapped[str] = mapped_column(String(20), nullable=False, default="year", server_default="year")
    target_score: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    final_variants_count: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    blocks = relationship(
        "PreparationPlanBlock",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PreparationPlanBlock.order_index",
    )


class PreparationPlanBlock(Base):
    __tablename__ = "preparation_plan_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("preparation_plans.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ege_numbers: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    task_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    estimated_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    required_solved_count: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    min_accuracy: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    requires_control_work: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    control_topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    includes_variant: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    plan = relationship("PreparationPlan", back_populates="blocks")


class UserPreparationPlan(Base):
    __tablename__ = "user_preparation_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("preparation_plans.id", ondelete="CASCADE"), nullable=False)
    active_block_id: Mapped[int | None] = mapped_column(
        ForeignKey("preparation_plan_blocks.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    plan = relationship("PreparationPlan")
    active_block = relationship("PreparationPlanBlock")
    user = relationship("User")
