"""Add pps_working_hours table for core time configuration

Revision ID: 010_add_pps_working_hours
Revises: f62007a04604_add_creator_employee_id_to_pps_todos
Create Date: 2026-01-24
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_pps_working_hours'
down_revision = 'f62007a04604'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pps_working_hours table
    op.create_table(
        'pps_working_hours',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('is_working_day', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('day_of_week')
    )
    op.create_index(op.f('ix_pps_working_hours_id'), 'pps_working_hours', ['id'], unique=False)
    
    # Insert default values (Monday-Friday 07:00-16:00, Saturday-Sunday off)
    op.execute("""
        INSERT INTO pps_working_hours (day_of_week, start_time, end_time, is_working_day, created_at, updated_at)
        VALUES 
            (0, '07:00:00', '16:00:00', 1, NOW(), NOW()),
            (1, '07:00:00', '16:00:00', 1, NOW(), NOW()),
            (2, '07:00:00', '16:00:00', 1, NOW(), NOW()),
            (3, '07:00:00', '16:00:00', 1, NOW(), NOW()),
            (4, '07:00:00', '16:00:00', 1, NOW(), NOW()),
            (5, NULL, NULL, 0, NOW(), NOW()),
            (6, NULL, NULL, 0, NOW(), NOW())
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_pps_working_hours_id'), table_name='pps_working_hours')
    op.drop_table('pps_working_hours')
