"""allow tasks without topics

Revision ID: fac1d2e3f4a5
Revises: f9c0d1e2f3a4
Create Date: 2026-09-06 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "fac1d2e3f4a5"
down_revision: Union[str, None] = "f9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"]: column for column in sa.inspect(bind).get_columns("tasks")}
    if "subject" not in columns:
        op.add_column("tasks", sa.Column("subject", sa.String(length=50), server_default="informatics", nullable=False))
    if "exam_type" not in columns:
        op.add_column("tasks", sa.Column("exam_type", sa.String(length=10), server_default="ege", nullable=False))
    op.execute(
        "UPDATE tasks SET subject = topics.subject, exam_type = topics.exam_type "
        "FROM topics WHERE tasks.topic_id = topics.id"
    )
    topic_id_column = next(
        column for column in sa.inspect(bind).get_columns("tasks")
        if column["name"] == "topic_id"
    )
    if not topic_id_column["nullable"]:
        op.alter_column("tasks", "topic_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM tasks WHERE topic_id IS NULL")
    bind = op.get_bind()
    columns = {column["name"]: column for column in sa.inspect(bind).get_columns("tasks")}
    if columns["topic_id"]["nullable"]:
        op.alter_column("tasks", "topic_id", existing_type=sa.Integer(), nullable=False)
    if "exam_type" in columns:
        op.drop_column("tasks", "exam_type")
    if "subject" in columns:
        op.drop_column("tasks", "subject")
