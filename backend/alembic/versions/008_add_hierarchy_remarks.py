"""Add hierarchy_remarks table for storing remarks on HUGWAWI elements

Revision ID: 008
Revises: 007_add_userlogin_log
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_hierarchy_remarks'
down_revision = '007_add_userlogin_log'
branch_labels = None
depends_on = None


def upgrade():
    # Create hierarchy_remarks table
    op.create_table(
        'hierarchy_remarks',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('level_type', sa.String(20), nullable=False),
        sa.Column('hugwawi_id', sa.Integer(), nullable=False),
        sa.Column('remark', sa.Text(), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create composite index for fast lookups by level_type and hugwawi_id
    op.create_index('idx_level_hugwawi', 'hierarchy_remarks', ['level_type', 'hugwawi_id'])
    
    # Create index on id for fast primary key lookups
    op.create_index('ix_hierarchy_remarks_id', 'hierarchy_remarks', ['id'])


def downgrade():
    op.drop_index('ix_hierarchy_remarks_id', table_name='hierarchy_remarks')
    op.drop_index('idx_level_hugwawi', table_name='hierarchy_remarks')
    op.drop_table('hierarchy_remarks')
