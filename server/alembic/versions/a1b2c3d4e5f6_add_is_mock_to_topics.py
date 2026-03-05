"""add is_mock to topics

Revision ID: a1b2c3d4e5f6
Revises: cf7f1c1ef3ae
Create Date: 2026-03-05

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cf7f1c1ef3ae'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('topics', sa.Column('is_mock', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('topics', 'is_mock')
