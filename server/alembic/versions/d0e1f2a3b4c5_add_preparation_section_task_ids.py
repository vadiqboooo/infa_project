"""add preparation section task ids

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "preparation_plan_blocks",
        sa.Column("task_ids", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "preparation_plan_blocks",
        sa.Column("estimated_score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "preparation_plan_blocks",
        sa.Column("includes_variant", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("preparation_plan_blocks", "includes_variant")
    op.drop_column("preparation_plan_blocks", "estimated_score")
    op.drop_column("preparation_plan_blocks", "task_ids")
