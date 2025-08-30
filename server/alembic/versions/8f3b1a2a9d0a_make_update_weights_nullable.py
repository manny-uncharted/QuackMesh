"""make_update_weights_nullable

Revision ID: 8f3b1a2a9d0a
Revises: 0e5e9c4c2d7a
Create Date: 2025-08-30 13:32:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '8f3b1a2a9d0a'
down_revision = '0e5e9c4c2d7a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('updates', 'weights', existing_type=sa.JSON(), nullable=True)


def downgrade() -> None:
    op.alter_column('updates', 'weights', existing_type=sa.JSON(), nullable=False)
