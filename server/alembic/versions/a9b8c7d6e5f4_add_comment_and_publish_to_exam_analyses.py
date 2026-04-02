"""add comment and is_published to exam_analyses

Revision ID: a9b8c7d6e5f4
Revises: f1a2b3c4d5e6
Create Date: 2026-04-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exam_analyses', sa.Column('comment', sa.Text(), nullable=True))
    op.add_column('exam_analyses', sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('exam_analyses', 'is_published')
    op.drop_column('exam_analyses', 'comment')
