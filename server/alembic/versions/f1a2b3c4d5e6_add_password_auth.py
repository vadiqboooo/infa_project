"""add password auth fields to users

Revision ID: f1a2b3c4d5e6
Revises: 8afce74e202e
Create Date: 2026-03-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '8afce74e202e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make tg_id nullable (was NOT NULL before)
    op.alter_column('users', 'tg_id', nullable=True)

    # Add login/password columns
    op.add_column('users', sa.Column('login', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('plain_password', sa.String(length=100), nullable=True))

    op.create_unique_constraint('uq_users_login', 'users', ['login'])
    op.create_index('ix_users_login', 'users', ['login'])


def downgrade() -> None:
    op.drop_index('ix_users_login', table_name='users')
    op.drop_constraint('uq_users_login', 'users', type_='unique')
    op.drop_column('users', 'plain_password')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'login')
    op.alter_column('users', 'tg_id', nullable=False)
