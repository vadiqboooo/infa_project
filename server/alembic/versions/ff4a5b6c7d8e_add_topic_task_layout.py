"""Add per-topic task display layout."""
from alembic import op
import sqlalchemy as sa

revision = "ff4a5b6c7d8e"
down_revision = "fe3a4b5c6d7e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("topics", sa.Column("task_layout", sa.String(16), nullable=False, server_default="single"))


def downgrade():
    op.drop_column("topics", "task_layout")
