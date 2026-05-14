"""add payments

Revision ID: 1a2b3c4d5e6f
Revises: 0f1e2d3c4b5a
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "1a2b3c4d5e6f"
down_revision: Union[str, None] = "0f1e2d3c4b5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = inspect(op.get_bind())
    if not inspector.has_table("payments"):
        op.create_table(
            "payments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("plan", sa.String(length=20), nullable=False),
            sa.Column("amount_value", sa.String(length=20), nullable=False),
            sa.Column("currency", sa.String(length=3), server_default="RUB", nullable=False),
            sa.Column("status", sa.String(length=40), server_default="pending", nullable=False),
            sa.Column("yookassa_payment_id", sa.String(length=80), nullable=True),
            sa.Column("idempotence_key", sa.String(length=80), nullable=False),
            sa.Column("confirmation_url", sa.String(length=1024), nullable=True),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("yookassa_payment_id", name="uq_payments_yookassa_payment_id"),
        )

    indexes = {index["name"] for index in inspector.get_indexes("payments")}
    if "ix_payments_user_id" not in indexes:
        op.create_index(op.f("ix_payments_user_id"), "payments", ["user_id"], unique=False)
    if "ix_payments_yookassa_payment_id" not in indexes:
        op.create_index(op.f("ix_payments_yookassa_payment_id"), "payments", ["yookassa_payment_id"], unique=False)
    if "ix_payments_idempotence_key" not in indexes:
        op.create_index(op.f("ix_payments_idempotence_key"), "payments", ["idempotence_key"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_payments_idempotence_key"), table_name="payments")
    op.drop_index(op.f("ix_payments_yookassa_payment_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_user_id"), table_name="payments")
    op.drop_table("payments")
