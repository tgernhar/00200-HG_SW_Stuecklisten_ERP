"""add gantt_display_type to pps_todos

Revision ID: 013_add_gantt_display_type
Revises: 012_add_resource_department
Create Date: 2026-01-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013_add_gantt_display_type'
down_revision = '012_add_resource_department'
branch_labels = None
depends_on = None


def upgrade():
    # Add gantt_display_type column (nullable, default will be computed from todo_type)
    op.add_column('pps_todos', sa.Column('gantt_display_type', sa.String(20), nullable=True))
    
    # Set default values based on existing todo_type
    # container_* → 'project', others → 'task'
    op.execute("""
        UPDATE pps_todos 
        SET gantt_display_type = CASE 
            WHEN todo_type LIKE 'container_%' THEN 'project'
            ELSE 'task'
        END
        WHERE gantt_display_type IS NULL
    """)


def downgrade():
    op.drop_column('pps_todos', 'gantt_display_type')
