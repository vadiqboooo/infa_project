"""add subject to topics

Revision ID: b6c7d8e9f0a1
Revises: a7c8d9e0f1a2
Create Date: 2026-05-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6c7d8e9f0a1"
down_revision: Union[str, None] = "a7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("subject", sa.String(length=50), nullable=False, server_default="informatics"),
    )
    op.execute("UPDATE topics SET subject = 'math' WHERE category = 'math'")


def downgrade() -> None:
    op.drop_column("topics", "subject")
