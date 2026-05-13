"""add subscriptions and course type

Revision ID: b4c5d6e7f8a9
Revises: a3c4e5f6a7b9
Create Date: 2026-05-12 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3c4e5f6a7b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("subscription_plan", sa.String(length=20), nullable=False, server_default="none"),
    )
    op.add_column("users", sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "preparation_plans",
        sa.Column("course_type", sa.String(length=20), nullable=False, server_default="year"),
    )


def downgrade() -> None:
    op.drop_column("preparation_plans", "course_type")
    op.drop_column("users", "subscription_expires_at")
    op.drop_column("users", "subscription_plan")
