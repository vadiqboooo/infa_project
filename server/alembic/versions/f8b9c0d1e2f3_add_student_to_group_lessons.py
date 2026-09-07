"""add student-specific group lesson plans

Revision ID: f8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-09-06 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f8b9c0d1e2f3"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {column["name"] for column in inspector.get_columns("group_lessons")}
    if "student_id" not in columns:
        op.add_column("group_lessons", sa.Column("student_id", sa.Integer(), nullable=True))

    inspector = sa.inspect(bind)
    student_foreign_key_exists = any(
        foreign_key.get("constrained_columns") == ["student_id"]
        and foreign_key.get("referred_table") == "users"
        for foreign_key in inspector.get_foreign_keys("group_lessons")
    )
    if not student_foreign_key_exists:
        op.create_foreign_key(
            "fk_group_lessons_student_id_users",
            "group_lessons",
            "users",
            ["student_id"],
            ["id"],
            ondelete="CASCADE",
        )

    inspector = sa.inspect(bind)
    student_index_exists = any(
        index.get("column_names") == ["student_id"]
        for index in inspector.get_indexes("group_lessons")
    )
    if not student_index_exists:
        op.create_index(op.f("ix_group_lessons_student_id"), "group_lessons", ["student_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("group_lessons")}
    if "student_id" in columns:
        op.drop_column("group_lessons", "student_id")
