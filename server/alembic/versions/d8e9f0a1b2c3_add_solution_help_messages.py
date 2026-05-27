"""add solution help messages

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-05-22 13:20:00.000000
"""

from alembic import op


revision = "d8e9f0a1b2c3"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE user_task_solution_help_requests "
        "ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'open'"
    )
    op.execute(
        "ALTER TABLE user_task_solution_help_requests "
        "ADD COLUMN IF NOT EXISTS closed_by_id INTEGER"
    )
    op.execute(
        "ALTER TABLE user_task_solution_help_requests "
        "ADD COLUMN IF NOT EXISTS close_reason VARCHAR(64)"
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_user_task_solution_help_requests_closed_by_id_users'
            ) THEN
                ALTER TABLE user_task_solution_help_requests
                ADD CONSTRAINT fk_user_task_solution_help_requests_closed_by_id_users
                FOREIGN KEY (closed_by_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_task_solution_help_messages (
            id SERIAL PRIMARY KEY,
            help_request_id INTEGER NOT NULL REFERENCES user_task_solution_help_requests(id) ON DELETE CASCADE,
            author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            author_role VARCHAR(32) NOT NULL,
            kind VARCHAR(32) NOT NULL DEFAULT 'text',
            text TEXT NOT NULL,
            payload JSON,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_task_solution_help_messages_help_request_id "
        "ON user_task_solution_help_messages (help_request_id)"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_task_solution_help_messages_help_request_id"), table_name="user_task_solution_help_messages")
    op.drop_table("user_task_solution_help_messages")
    op.drop_constraint(
        "fk_user_task_solution_help_requests_closed_by_id_users",
        "user_task_solution_help_requests",
        type_="foreignkey",
    )
    op.drop_column("user_task_solution_help_requests", "close_reason")
    op.drop_column("user_task_solution_help_requests", "closed_by_id")
    op.drop_column("user_task_solution_help_requests", "status")
