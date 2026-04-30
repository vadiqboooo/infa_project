"""add_image_to_topics

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-04-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('topics', sa.Column('image_data', sa.LargeBinary(), nullable=True))
    op.add_column('topics', sa.Column('image_mime', sa.String(length=64), nullable=True))
    op.add_column('topics', sa.Column('image_position', sa.String(length=16), nullable=True))
    op.add_column('topics', sa.Column('image_size', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('topics', 'image_size')
    op.drop_column('topics', 'image_position')
    op.drop_column('topics', 'image_mime')
    op.drop_column('topics', 'image_data')
