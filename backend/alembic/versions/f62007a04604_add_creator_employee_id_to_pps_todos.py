"""add creator_employee_id to pps_todos

Revision ID: f62007a04604
Revises: 009_add_pps_tables
Create Date: 2026-01-24 22:45:14.330414

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f62007a04604'
down_revision = '009_add_pps_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add creator_employee_id column to pps_todos
    op.add_column('pps_todos', sa.Column('creator_employee_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_pps_todos_creator_employee', 
        'pps_todos', 
        'pps_resource_cache', 
        ['creator_employee_id'], 
        ['id'], 
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop foreign key constraint first
    op.drop_constraint('fk_pps_todos_creator_employee', 'pps_todos', type_='foreignkey')
    
    # Drop column
    op.drop_column('pps_todos', 'creator_employee_id')
