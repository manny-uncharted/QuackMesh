"""add_hf_dataset_id_to_jobs

Revision ID: 0e5e9c4c2d7a
Revises: 7b0b2a7c1b1e
Create Date: 2025-08-30 13:18:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0e5e9c4c2d7a'
down_revision = '7b0b2a7c1b1e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('huggingface_dataset_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'huggingface_dataset_id')
