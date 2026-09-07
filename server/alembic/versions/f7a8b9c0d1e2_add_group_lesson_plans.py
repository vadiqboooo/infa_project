"""add group lesson plans

Revision ID: f7a8b9c0d1e2
Revises: e9f0a1b2c3d4
Create Date: 2026-09-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_lessons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("lesson_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("homework_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_group_lessons_group_id"), "group_lessons", ["group_id"], unique=False)
    op.create_index(op.f("ix_group_lessons_lesson_at"), "group_lessons", ["lesson_at"], unique=False)
    op.create_table(
        "group_lesson_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=20), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.CheckConstraint("(topic_id IS NOT NULL AND task_id IS NULL) OR (topic_id IS NULL AND task_id IS NOT NULL)", name="ck_group_lesson_item_resource"),
        sa.ForeignKeyConstraint(["lesson_id"], ["group_lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_group_lesson_items_lesson_id"), "group_lesson_items", ["lesson_id"], unique=False)
    op.create_index(op.f("ix_group_lesson_items_topic_id"), "group_lesson_items", ["topic_id"], unique=False)
    op.create_index(op.f("ix_group_lesson_items_task_id"), "group_lesson_items", ["task_id"], unique=False)


def downgrade() -> None:
    op.drop_table("group_lesson_items")
    op.drop_table("group_lessons")
