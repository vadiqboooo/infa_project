"""add topic visibility in tasks catalog

Revision ID: fb0d1e2f3a4b
Revises: fac1d2e3f4a5
Create Date: 2026-09-07 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "fb0d1e2f3a4b"
down_revision: Union[str, None] = "fac1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "topics",
        sa.Column("show_in_tasks", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("topics", "show_in_tasks")
