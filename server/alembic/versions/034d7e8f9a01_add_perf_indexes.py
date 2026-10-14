"""Indexes for admin list queries (tasks by topic / ege number, attempts by user)."""
from alembic import op

revision = "034d7e8f9a01"
down_revision = "024c6d7e8f90"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_topic_id ON tasks (topic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_ege_number ON tasks (ege_number)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_exam_attempts_user_id ON exam_attempts (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_progress_task_id ON user_progress (task_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_user_progress_task_id")
    op.execute("DROP INDEX IF EXISTS ix_exam_attempts_user_id")
    op.execute("DROP INDEX IF EXISTS ix_tasks_ege_number")
    op.execute("DROP INDEX IF EXISTS ix_tasks_topic_id")
