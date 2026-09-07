"""add exam type to topics

Revision ID: f9c0d1e2f3a4
Revises: f8b9c0d1e2f3
Create Date: 2026-09-06 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f9c0d1e2f3a4"
down_revision: Union[str, None] = "f8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("topics")}
    if "exam_type" not in columns:
        op.add_column(
            "topics",
            sa.Column("exam_type", sa.String(length=10), server_default="ege", nullable=False),
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("topics")}
    if "exam_type" in columns:
        op.drop_column("topics", "exam_type")
