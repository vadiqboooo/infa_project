"""add course type to topics

Revision ID: a8b9c0d1e2f3
Revises: 2b3c4d5e6f7a
Create Date: 2026-05-16 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "2b3c4d5e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("course_type", sa.String(length=20), nullable=False, server_default="year"),
    )
    op.execute("UPDATE topics SET course_type = 'common' WHERE category IN ('variants', 'math', 'mock')")


def downgrade() -> None:
    op.drop_column("topics", "course_type")
