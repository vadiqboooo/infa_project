"""add_cascade_delete_to_exam_attempts

Revision ID: b8587d44b910
Revises: 332ed3c3cbd8
Create Date: 2026-03-01 16:08:58.592170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8587d44b910'
down_revision: Union[str, None] = '332ed3c3cbd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old foreign key constraint
    op.drop_constraint('exam_attempts_exam_id_fkey', 'exam_attempts', type_='foreignkey')

    # Add new foreign key constraint with CASCADE
    op.create_foreign_key(
        'exam_attempts_exam_id_fkey',
        'exam_attempts',
        'exams',
        ['exam_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Drop the CASCADE foreign key
    op.drop_constraint('exam_attempts_exam_id_fkey', 'exam_attempts', type_='foreignkey')

    # Restore the old foreign key without CASCADE
    op.create_foreign_key(
        'exam_attempts_exam_id_fkey',
        'exam_attempts',
        'exams',
        ['exam_id'],
        ['id']
    )
