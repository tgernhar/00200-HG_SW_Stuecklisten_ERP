"""Add erp_department_id to pps_resource_cache

Revision ID: 012_add_resource_department
Revises: 011_add_erp_packingnote_details_id
Create Date: 2026-01-25

Adds the erp_department_id column to pps_resource_cache table
to track which department a machine belongs to (from qualificationitem.department).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012_add_resource_department'
down_revision = '011_add_erp_packingnote_details_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add erp_department_id column to pps_resource_cache
    # This stores the department ID from qualificationitem.department for machines
    op.add_column('pps_resource_cache', sa.Column('erp_department_id', sa.Integer(), nullable=True))
    
    # Add index for performance on department lookups
    op.create_index('idx_resource_department', 'pps_resource_cache', ['erp_department_id'])


def downgrade() -> None:
    # Drop index first
    op.drop_index('idx_resource_department', table_name='pps_resource_cache')
    
    # Drop column
    op.drop_column('pps_resource_cache', 'erp_department_id')
