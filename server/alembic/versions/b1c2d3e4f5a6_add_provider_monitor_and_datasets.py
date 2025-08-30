"""add_provider_monitor_and_datasets

Revision ID: b1c2d3e4f5a6
Revises: 8f3b1a2a9d0a
Create Date: 2025-08-30 18:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '8f3b1a2a9d0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ProviderMachine heartbeat/monitoring and marketplace listing fields
    op.add_column('provider_machines', sa.Column('last_seen', sa.DateTime(), nullable=True))
    op.add_column('provider_machines', sa.Column('status', sa.String(), nullable=True, server_default='offline'))
    op.add_column('provider_machines', sa.Column('metrics', sa.JSON(), nullable=True))
    op.add_column('provider_machines', sa.Column('price_per_hour_wei', sa.String(), nullable=True))
    op.add_column('provider_machines', sa.Column('listed', sa.Integer(), nullable=True, server_default='0'))

    # Datasets table
    op.create_table(
        'datasets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('owner_address', sa.String(), nullable=True, index=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('uri', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('fmt', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_datasets_owner_address', 'datasets', ['owner_address'], unique=False)


def downgrade() -> None:
    # Drop datasets
    op.drop_index('ix_datasets_owner_address', table_name='datasets')
    op.drop_table('datasets')

    # Drop provider_machines added columns
    op.drop_column('provider_machines', 'listed')
    op.drop_column('provider_machines', 'price_per_hour_wei')
    op.drop_column('provider_machines', 'metrics')
    op.drop_column('provider_machines', 'status')
    op.drop_column('provider_machines', 'last_seen')
