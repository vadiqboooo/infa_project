"""add task solution comments

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "user_task_solution_comments" not in tables:
        op.create_table(
            "user_task_solution_comments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("solution_id", sa.Integer(), nullable=False),
            sa.Column("author_id", sa.Integer(), nullable=True),
            sa.Column("from_line", sa.Integer(), nullable=False),
            sa.Column("from_col", sa.Integer(), nullable=False),
            sa.Column("to_line", sa.Integer(), nullable=False),
            sa.Column("to_col", sa.Integer(), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["solution_id"], ["user_task_solutions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        inspector = sa.inspect(bind)
    indexes = {idx["name"] for idx in inspector.get_indexes("user_task_solution_comments")}
    index_name = op.f("ix_user_task_solution_comments_solution_id")
    if index_name not in indexes:
        op.create_index(
            index_name,
            "user_task_solution_comments",
            ["solution_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return
    indexes = {idx["name"] for idx in inspector.get_indexes("user_task_solution_comments")}
    index_name = op.f("ix_user_task_solution_comments_solution_id")
    if index_name in indexes:
        op.drop_index(index_name, table_name="user_task_solution_comments")
    op.drop_table("user_task_solution_comments")
