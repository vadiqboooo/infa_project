"""add results_json to exam_attempts

Revision ID: d5e6f7a8b9c0
Revises: cf7f1c1ef3ae
Create Date: 2026-03-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'cf7f1c1ef3ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exam_attempts', sa.Column('results_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('exam_attempts', 'results_json')
