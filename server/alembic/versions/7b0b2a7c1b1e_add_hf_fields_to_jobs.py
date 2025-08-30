"""add_hf_fields_to_jobs

Revision ID: 7b0b2a7c1b1e
Revises: fa139185c9ae
Create Date: 2025-08-30 12:58:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7b0b2a7c1b1e'
down_revision = 'fa139185c9ae'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('huggingface_model_id', sa.String(), nullable=True))
    op.add_column('jobs', sa.Column('hf_token_enc', sa.LargeBinary(), nullable=True))
    op.add_column('jobs', sa.Column('hf_private', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'hf_private')
    op.drop_column('jobs', 'hf_token_enc')
    op.drop_column('jobs', 'huggingface_model_id')
