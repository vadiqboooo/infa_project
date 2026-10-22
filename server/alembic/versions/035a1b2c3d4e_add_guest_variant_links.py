"""Add guest links for variants: topics.guest_token, users.guest_topic_id."""
from alembic import op

revision = "035a1b2c3d4e"
down_revision = "034d7e8f9a01"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE topics ADD COLUMN IF NOT EXISTS guest_token VARCHAR(32)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_topics_guest_token ON topics (guest_token)")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL"
    )


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS guest_topic_id")
    op.execute("DROP INDEX IF EXISTS ix_topics_guest_token")
    op.execute("ALTER TABLE topics DROP COLUMN IF EXISTS guest_token")
