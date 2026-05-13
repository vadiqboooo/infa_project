"""add preparation plans

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "preparation_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("target_score", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_duration_days", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("final_variants_count", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "preparation_plan_blocks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("preparation_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ege_numbers", sa.JSON(), nullable=False),
        sa.Column("required_solved_count", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("min_accuracy", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("requires_control_work", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "user_preparation_plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("preparation_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.Date(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_preparation_plans_user_id", "user_preparation_plans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_preparation_plans_user_id", table_name="user_preparation_plans")
    op.drop_table("user_preparation_plans")
    op.drop_table("preparation_plan_blocks")
    op.drop_table("preparation_plans")
