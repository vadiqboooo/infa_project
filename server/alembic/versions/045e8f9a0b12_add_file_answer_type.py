"""Add file attachment answers."""
from alembic import op

revision = "045e8f9a0b12"
down_revision = "035a1b2c3d4e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE answertype ADD VALUE IF NOT EXISTS 'file'")


def downgrade():
    # PostgreSQL cannot remove an enum member. Preserve answers as plain text.
    op.execute("UPDATE tasks SET answer_type = 'text' WHERE answer_type = 'file'")
