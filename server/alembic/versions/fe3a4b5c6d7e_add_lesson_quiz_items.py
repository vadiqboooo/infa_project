"""Separate reading and quizzes in lesson plans."""
from alembic import op
import sqlalchemy as sa

revision = "fe3a4b5c6d7e"
down_revision = "fd2f3a4b5c6d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("group_lesson_items", sa.Column("article_mode", sa.String(10), nullable=False, server_default="reading"))
    op.create_check_constraint("ck_group_lesson_article_mode", "group_lesson_items", "article_mode = 'reading' OR (article_mode = 'quiz' AND article_id IS NOT NULL)")


def downgrade():
    op.execute("UPDATE group_lesson_items SET section = 'lesson' WHERE section IN ('theory', 'testing')")
    op.drop_constraint("ck_group_lesson_article_mode", "group_lesson_items", type_="check")
    op.drop_column("group_lesson_items", "article_mode")
