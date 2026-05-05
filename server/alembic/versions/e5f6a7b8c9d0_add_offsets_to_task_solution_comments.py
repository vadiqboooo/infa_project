"""add offsets to task solution comments

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_task_solution_comments")}
    if "from_offset" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("from_offset", sa.Integer(), nullable=True))
    if "to_offset" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("to_offset", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_task_solution_comments")}
    if "to_offset" in columns:
        op.drop_column("user_task_solution_comments", "to_offset")
    if "from_offset" in columns:
        op.drop_column("user_task_solution_comments", "from_offset")
