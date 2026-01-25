"""add progress field to pps_todos

Revision ID: 014_add_progress_field
Revises: 013_add_gantt_display_type
Create Date: 2026-01-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '014_add_progress_field'
down_revision = '013_add_gantt_display_type'
branch_labels = None
depends_on = None


def upgrade():
    # Add progress column (0.0 - 1.0, default 0.0)
    op.add_column('pps_todos', sa.Column('progress', sa.Float(), nullable=False, server_default='0.0'))


def downgrade():
    op.drop_column('pps_todos', 'progress')
