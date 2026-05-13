"""add image solution comment coordinates

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-09 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user_task_solution_comments")}
    if "target_type" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("target_type", sa.String(length=16), nullable=True))
    if "image_x" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("image_x", sa.Float(), nullable=True))
    if "image_y" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("image_y", sa.Float(), nullable=True))
    if "image_drawing" not in columns:
        op.add_column("user_task_solution_comments", sa.Column("image_drawing", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user_task_solution_comments")}
    if "image_drawing" in columns:
        op.drop_column("user_task_solution_comments", "image_drawing")
    if "image_y" in columns:
        op.drop_column("user_task_solution_comments", "image_y")
    if "image_x" in columns:
        op.drop_column("user_task_solution_comments", "image_x")
    if "target_type" in columns:
        op.drop_column("user_task_solution_comments", "target_type")
