"""seed editable math topics

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-05-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b6c7d8e9f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO topics (title, order_index, category, subject, course_type, is_mock, ege_number)
        SELECT
            'Математика №' || n::text,
            n,
            'tutorial',
            'math',
            'common',
            0,
            n
        FROM generate_series(1, 19) AS n
        WHERE NOT EXISTS (
            SELECT 1
            FROM topics
            WHERE subject = 'math'
              AND category IN ('tutorial', 'math')
              AND ege_number = n
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM topics
        WHERE subject = 'math'
          AND category = 'tutorial'
          AND ege_number BETWEEN 1 AND 19
          AND title = 'Математика №' || ege_number::text
          AND NOT EXISTS (
              SELECT 1 FROM tasks WHERE tasks.topic_id = topics.id
          )
        """
    )
