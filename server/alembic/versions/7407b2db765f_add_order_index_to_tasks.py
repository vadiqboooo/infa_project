"""add_order_index_to_tasks

Revision ID: 7407b2db765f
Revises: 84feb0b8e2d4
Create Date: 2026-03-01 14:15:51.357425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7407b2db765f'
down_revision: Union[str, None] = '84feb0b8e2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонку order_index
    op.add_column('tasks', sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'))

    # Заполняем order_index текущими ID (чтобы сохранить порядок)
    op.execute('UPDATE tasks SET order_index = id')


def downgrade() -> None:
    # Удаляем колонку order_index
    op.drop_column('tasks', 'order_index')
