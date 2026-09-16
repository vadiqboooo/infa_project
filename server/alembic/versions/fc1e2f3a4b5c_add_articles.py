"""Articles, quiz progress, and article attachments in lesson plans."""
from alembic import op
import sqlalchemy as sa

revision = "fc1e2f3a4b5c"
down_revision = "0a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("articles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_table("article_progress",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False),
        sa.Column("best_score", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False))
    op.add_column("group_lesson_items", sa.Column("article_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_group_lesson_items_article", "group_lesson_items", "articles", ["article_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_group_lesson_items_article_id", "group_lesson_items", ["article_id"])
    op.drop_constraint("ck_group_lesson_item_resource", "group_lesson_items", type_="check")
    op.create_check_constraint("ck_group_lesson_item_resource", "group_lesson_items",
        "(CASE WHEN topic_id IS NULL THEN 0 ELSE 1 END + CASE WHEN task_id IS NULL THEN 0 ELSE 1 END + CASE WHEN article_id IS NULL THEN 0 ELSE 1 END) = 1")


def downgrade():
    # Article attachments have no topic/task equivalent.
    op.execute("DELETE FROM group_lesson_items WHERE article_id IS NOT NULL")
    op.drop_constraint("ck_group_lesson_item_resource", "group_lesson_items", type_="check")
    op.drop_index("ix_group_lesson_items_article_id", table_name="group_lesson_items")
    op.drop_constraint("fk_group_lesson_items_article", "group_lesson_items", type_="foreignkey")
    op.drop_column("group_lesson_items", "article_id")
    op.create_check_constraint("ck_group_lesson_item_resource", "group_lesson_items", "(topic_id IS NOT NULL AND task_id IS NULL) OR (topic_id IS NULL AND task_id IS NOT NULL)")
    op.drop_table("article_progress")
    op.drop_table("articles")
