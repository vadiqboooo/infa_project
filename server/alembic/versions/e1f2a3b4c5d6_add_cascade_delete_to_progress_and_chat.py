"""add cascade delete to progress and chat logs

Revision ID: e1f2a3b4c5d6
Revises: d5e6f7a8b9c0
Create Date: 2026-03-06 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_progress.task_id
    op.drop_constraint('user_progress_task_id_fkey', 'user_progress', type_='foreignkey')
    op.create_foreign_key(
        'user_progress_task_id_fkey', 'user_progress', 'tasks',
        ['task_id'], ['id'], ondelete='CASCADE'
    )
    # ai_chat_logs.task_id
    op.drop_constraint('ai_chat_logs_task_id_fkey', 'ai_chat_logs', type_='foreignkey')
    op.create_foreign_key(
        'ai_chat_logs_task_id_fkey', 'ai_chat_logs', 'tasks',
        ['task_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('ai_chat_logs_task_id_fkey', 'ai_chat_logs', type_='foreignkey')
    op.create_foreign_key(
        'ai_chat_logs_task_id_fkey', 'ai_chat_logs', 'tasks',
        ['task_id'], ['id']
    )
    op.drop_constraint('user_progress_task_id_fkey', 'user_progress', type_='foreignkey')
    op.create_foreign_key(
        'user_progress_task_id_fkey', 'user_progress', 'tasks',
        ['task_id'], ['id']
    )
