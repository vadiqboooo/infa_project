"""add_solution_comment_reads

Revision ID: f5a6b7c8d9e0
Revises: f4a5b6c7d8e9
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa


revision = "f5a6b7c8d9e0"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comment_reads" in inspector.get_table_names():
        return

    op.create_table(
        "user_task_solution_comment_reads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["user_task_solution_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "comment_id", name="uq_user_task_solution_comment_read"),
    )
    op.create_index(
        op.f("ix_user_task_solution_comment_reads_comment_id"),
        "user_task_solution_comment_reads",
        ["comment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_task_solution_comment_reads_user_id"),
        "user_task_solution_comment_reads",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comment_reads" not in inspector.get_table_names():
        return

    op.drop_index(op.f("ix_user_task_solution_comment_reads_user_id"), table_name="user_task_solution_comment_reads")
    op.drop_index(op.f("ix_user_task_solution_comment_reads_comment_id"), table_name="user_task_solution_comment_reads")
    op.drop_table("user_task_solution_comment_reads")
