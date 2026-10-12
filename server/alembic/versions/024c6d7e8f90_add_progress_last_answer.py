"""Store the student's last submitted answer in user_progress."""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "024c6d7e8f90"
down_revision = "014b5c6d7e8f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user_progress", sa.Column("last_answer", postgresql.JSONB(), nullable=True))
    op.add_column("user_progress", sa.Column("last_correct", sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column("user_progress", "last_correct")
    op.drop_column("user_progress", "last_answer")
