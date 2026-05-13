"""add preparation block control topic

Revision ID: f2a3b4c5d6e7
Revises: d0e1f2a3b4c5
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("preparation_plan_blocks", sa.Column("control_topic_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_preparation_plan_blocks_control_topic_id_topics",
        "preparation_plan_blocks",
        "topics",
        ["control_topic_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_preparation_plan_blocks_control_topic_id_topics",
        "preparation_plan_blocks",
        type_="foreignkey",
    )
    op.drop_column("preparation_plan_blocks", "control_topic_id")
