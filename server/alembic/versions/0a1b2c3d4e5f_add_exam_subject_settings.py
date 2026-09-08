"""add exam subject settings

Revision ID: 0a1b2c3d4e5f
Revises: fb0d1e2f3a4b
Create Date: 2026-09-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0a1b2c3d4e5f"
down_revision: Union[str, None] = "fb0d1e2f3a4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("exam_subject_settings"):
        op.create_table(
            "exam_subject_settings",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("exam_type", sa.String(length=10), nullable=False),
            sa.Column("subject", sa.String(length=50), nullable=False),
            sa.Column("task_count", sa.Integer(), server_default="1", nullable=False),
            sa.Column("task_names", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("exam_type", "subject", name="uq_exam_subject_settings_pair"),
        )


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("exam_subject_settings"):
        op.drop_table("exam_subject_settings")
