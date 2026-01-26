"""Add level field to pps_resource_cache

Revision ID: 016
Revises: f62007a04604
Create Date: 2026-01-25

Adds level field to pps_resource_cache table for filtering resources by
qualificationitem.level from HUGWAWI.

Level meanings:
- 1: CNC machines that work autonomously
- 2: Construction/programming workstations, main machines, bending forms
- 3: Less used machines, hand tools, aids (default)
- 4: Rarely used machines and aids
- 5: Very rarely used aids (special projects)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_resource_level'
down_revision = '015_add_crm_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Add level column to pps_resource_cache
    # Default to 3 (standard/medium) for existing resources
    op.add_column('pps_resource_cache', sa.Column('level', sa.Integer(), nullable=True, default=3))
    
    # Set default level for existing machine resources
    op.execute("UPDATE pps_resource_cache SET level = 3 WHERE resource_type = 'machine' AND level IS NULL")


def downgrade():
    op.drop_column('pps_resource_cache', 'level')
