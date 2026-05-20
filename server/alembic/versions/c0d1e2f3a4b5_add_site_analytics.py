"""add site analytics

Revision ID: c0d1e2f3a4b5
Revises: a8b9c0d1e2f3
Create Date: 2026-05-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "created_at" not in user_columns:
        op.add_column(
            "users",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )

    if not inspector.has_table("site_visits"):
        op.create_table(
            "site_visits",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("visitor_id", sa.String(length=80), nullable=False),
            sa.Column("session_id", sa.String(length=80), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("path", sa.String(length=512), nullable=False),
            sa.Column("referrer", sa.Text(), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = {index["name"] for index in inspector.get_indexes("site_visits")}
    for name, columns in {
        "ix_site_visits_created_at": ["created_at"],
        "ix_site_visits_session_id": ["session_id"],
        "ix_site_visits_user_id": ["user_id"],
        "ix_site_visits_visitor_id": ["visitor_id"],
    }.items():
        if name not in indexes:
            op.create_index(name, "site_visits", columns, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("site_visits"):
        indexes = {index["name"] for index in inspector.get_indexes("site_visits")}
        for name in [
            "ix_site_visits_visitor_id",
            "ix_site_visits_user_id",
            "ix_site_visits_session_id",
            "ix_site_visits_created_at",
        ]:
            if name in indexes:
                op.drop_index(name, table_name="site_visits")
        op.drop_table("site_visits")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "created_at" in user_columns:
        op.drop_column("users", "created_at")
