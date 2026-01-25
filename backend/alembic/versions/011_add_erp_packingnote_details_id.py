"""Add erp_packingnote_details_id to pps_todos

Revision ID: 011_add_erp_packingnote_details_id
Revises: 010_add_pps_working_hours
Create Date: 2026-01-25

Adds the erp_packingnote_details_id column to pps_todos table
to track the packingnote_details (BOM item) reference from HUGWAWI.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_add_erp_packingnote_details_id'
down_revision = '010_add_pps_working_hours'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add erp_packingnote_details_id column to pps_todos
    op.add_column('pps_todos', sa.Column('erp_packingnote_details_id', sa.Integer(), nullable=True))
    
    # Add index for performance on packingnote lookups
    op.create_index('idx_todo_packingnote', 'pps_todos', ['erp_packingnote_details_id'])


def downgrade() -> None:
    # Drop index first
    op.drop_index('idx_todo_packingnote', table_name='pps_todos')
    
    # Drop column
    op.drop_column('pps_todos', 'erp_packingnote_details_id')
