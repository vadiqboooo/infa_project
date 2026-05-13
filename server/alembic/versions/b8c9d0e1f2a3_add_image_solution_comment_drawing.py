"""add image solution comment drawing

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-09 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_task_solution_comments" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("user_task_solution_comments")}
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
