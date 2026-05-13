"""add user preparation active block

Revision ID: a3c4e5f6a7b9
Revises: f2a3b4c5d6e7
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3c4e5f6a7b9"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_preparation_plans", sa.Column("active_block_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_user_prep_plans_active_block",
        "user_preparation_plans",
        "preparation_plan_blocks",
        ["active_block_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_user_prep_plans_active_block",
        "user_preparation_plans",
        type_="foreignkey",
    )
    op.drop_column("user_preparation_plans", "active_block_id")
