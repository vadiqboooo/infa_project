"""Add share links and per-user topic grants for Telegram posts."""
from alembic import op
import sqlalchemy as sa

revision = "055a1b2c3d4e"
down_revision = "045e8f9a0b12"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("topics", sa.Column("telegram_share_token", sa.String(48), nullable=True))
    op.create_index("ix_topics_telegram_share_token", "topics", ["telegram_share_token"], unique=True)
    op.create_table(
        "user_topic_shares",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade():
    op.drop_table("user_topic_shares")
    op.drop_index("ix_topics_telegram_share_token", table_name="topics")
    op.drop_column("topics", "telegram_share_token")
