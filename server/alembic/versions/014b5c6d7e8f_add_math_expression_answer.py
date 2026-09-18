"""Add exact mathematical expression answers."""
from alembic import op

revision = "014b5c6d7e8f"
down_revision = "ff4a5b6c7d8e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE answertype ADD VALUE IF NOT EXISTS 'math_expression'")


def downgrade():
    # PostgreSQL cannot remove an enum member. Preserve answers as plain text.
    op.execute("UPDATE tasks SET answer_type = 'text' WHERE answer_type = 'math_expression'")
