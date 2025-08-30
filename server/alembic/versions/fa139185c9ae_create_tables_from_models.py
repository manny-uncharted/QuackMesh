"""create tables from models

Revision ID: fa139185c9ae
Revises: 3d9d09575082
Create Date: 2025-08-30 00:56:52.472517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa139185c9ae'
down_revision: Union[str, None] = '3d9d09575082'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Jobs
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('model_arch', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('reward_pool_duck', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    # Updates
    op.create_table(
        'updates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id'), nullable=False),
        sa.Column('weights', sa.JSON(), nullable=False),
        sa.Column('val_accuracy', sa.Float(), nullable=True),
        sa.Column('contributor', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_updates_job_id', 'updates', ['job_id'], unique=False)

    # Model Artifacts (one per job)
    op.create_table(
        'model_artifacts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id'), unique=True, nullable=False),
        sa.Column('weights', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # Provider Machines (on-chain machine registry mirrored to orchestrator)
    op.create_table(
        'provider_machines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('machine_id', sa.Integer(), unique=True, nullable=False),
        sa.Column('provider_address', sa.String(), nullable=True),
        sa.Column('specs', sa.String(), nullable=True),
        sa.Column('endpoint', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_provider_machines_provider_address', 'provider_machines', ['provider_address'], unique=False)

    # Cluster Nodes (assigned endpoints per job)
    op.create_table(
        'cluster_nodes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('job_id', sa.Integer(), nullable=True),
        sa.Column('machine_id', sa.Integer(), nullable=True),
        sa.Column('endpoint', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_cluster_nodes_job_id', 'cluster_nodes', ['job_id'], unique=False)
    op.create_index('ix_cluster_nodes_machine_id', 'cluster_nodes', ['machine_id'], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index('ix_cluster_nodes_machine_id', table_name='cluster_nodes')
    op.drop_index('ix_cluster_nodes_job_id', table_name='cluster_nodes')
    op.drop_table('cluster_nodes')

    op.drop_index('ix_provider_machines_provider_address', table_name='provider_machines')
    op.drop_table('provider_machines')

    op.drop_table('model_artifacts')

    op.drop_index('ix_updates_job_id', table_name='updates')
    op.drop_table('updates')

    op.drop_table('jobs')
