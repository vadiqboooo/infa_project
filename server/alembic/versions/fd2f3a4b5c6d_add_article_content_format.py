"""Support complete HTML documents alongside Markdown articles."""
from alembic import op
import sqlalchemy as sa

revision = "fd2f3a4b5c6d"
down_revision = "fc1e2f3a4b5c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("articles", sa.Column("content_format", sa.String(10), nullable=False, server_default="markdown"))


def downgrade():
    op.drop_column("articles", "content_format")
