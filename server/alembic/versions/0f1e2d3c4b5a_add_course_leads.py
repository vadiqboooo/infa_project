"""add course leads

Revision ID: 0f1e2d3c4b5a
Revises: b4c5d6e7f8a9
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0f1e2d3c4b5a"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not inspector.has_table("course_leads"):
        op.create_table(
            "course_leads",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("subject", sa.String(length=80), nullable=False),
            sa.Column("contact", sa.String(length=255), nullable=False),
            sa.Column("source", sa.String(length=40), server_default="landing", nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = {index["name"] for index in inspector.get_indexes("course_leads")}
    if "ix_course_leads_subject" not in indexes:
        op.create_index(op.f("ix_course_leads_subject"), "course_leads", ["subject"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_course_leads_subject"), table_name="course_leads")
    op.drop_table("course_leads")
