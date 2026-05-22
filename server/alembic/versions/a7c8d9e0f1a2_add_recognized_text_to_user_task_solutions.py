"""add recognized text to user task solutions

Revision ID: a7c8d9e0f1a2
Revises: c0d1e2f3a4b5
Create Date: 2026-05-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c8d9e0f1a2"
down_revision: Union[str, None] = "c0d1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solutions" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_task_solutions")}
    if "recognized_text" not in columns:
        op.add_column("user_task_solutions", sa.Column("recognized_text", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solutions" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("user_task_solutions")}
    if "recognized_text" in columns:
        op.drop_column("user_task_solutions", "recognized_text")
