"""add_ege_number_to_tasks

Revision ID: 332ed3c3cbd8
Revises: 598b2f11b15f
Create Date: 2026-03-01 14:39:32.482683

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '332ed3c3cbd8'
down_revision: Union[str, None] = '598b2f11b15f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('ege_number', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'ege_number')
