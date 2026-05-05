"""add_character_and_background_url_to_topics

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-02 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('topics', sa.Column('character_url', sa.String(length=255), nullable=True))
    op.add_column('topics', sa.Column('background_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('topics', 'background_url')
    op.drop_column('topics', 'character_url')
