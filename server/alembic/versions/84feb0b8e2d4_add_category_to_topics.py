"""add_category_to_topics

Revision ID: 84feb0b8e2d4
Revises: 7ac282628969
Create Date: 2026-03-01 11:54:37.436003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84feb0b8e2d4'
down_revision: Union[str, None] = '7ac282628969'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем колонку category
    op.add_column('topics', sa.Column('category', sa.String(length=50), nullable=False, server_default='tutorial'))


def downgrade() -> None:
    # Удаляем колонку category
    op.drop_column('topics', 'category')
