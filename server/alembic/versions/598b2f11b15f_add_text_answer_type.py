"""add_text_answer_type

Revision ID: 598b2f11b15f
Revises: 7407b2db765f
Create Date: 2026-03-01 14:31:36.069754

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '598b2f11b15f'
down_revision: Union[str, None] = '7407b2db765f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'text' value to answertype enum
    op.execute("ALTER TYPE answertype ADD VALUE IF NOT EXISTS 'text'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values directly
    # If you need to downgrade, you'll need to recreate the enum and update the column
    pass
