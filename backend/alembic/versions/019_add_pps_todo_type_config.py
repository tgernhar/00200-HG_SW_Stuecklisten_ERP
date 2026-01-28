"""Add PPS todo type configuration table

Revision ID: 019_add_pps_todo_type_config
Revises: 018_add_user_filter_presets
Create Date: 2026-01-28
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '019_add_pps_todo_type_config'
down_revision = '018_add_user_filter_presets'
branch_labels = None
depends_on = None


def upgrade():
    # Create todo type configuration table
    op.create_table(
        'pps_todo_type_config',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('todo_type', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(100), nullable=False, comment='German display name'),
        sa.Column('title_prefix', sa.String(50), nullable=True, comment='Prefix for todo title'),
        sa.Column('title_template', sa.String(200), nullable=False, comment='Template for title, e.g. "{prefix}{name}"'),
        sa.Column('gantt_color', sa.String(20), nullable=False, comment='Hex color for Gantt chart'),
        sa.Column('gantt_type', sa.String(20), nullable=False, default='task', comment='Gantt display type: task, project, milestone'),
        sa.Column('hierarchy_level', sa.Integer(), nullable=False, comment='1=Order, 2=Article, 3=BOM, 4=Operation'),
        sa.Column('default_duration_minutes', sa.Integer(), nullable=False, default=60),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Insert default configurations
    op.execute("""
        INSERT INTO pps_todo_type_config 
        (todo_type, display_name, title_prefix, title_template, gantt_color, gantt_type, hierarchy_level, default_duration_minutes, sort_order)
        VALUES 
        ('container_order', 'Auftrag', '', '{name}', '#4CAF50', 'project', 1, 60, 1),
        ('container_article', 'Auftragsartikel', 'Pos ', '{prefix}{position}: {articlenumber}', '#8BC34A', 'project', 2, 60, 2),
        ('bom_item', 'Stücklistenartikel', 'SL-Pos ', '{prefix}{pos}: {articlenumber}', '#FF9800', 'task', 3, 60, 3),
        ('operation', 'Arbeitsgang', 'AG ', '{prefix}{pos}: {workstep_name}', '#2196F3', 'task', 4, 60, 4),
        ('eigene', 'Eigene Aufgabe', '', '{title}', '#9C27B0', 'task', 5, 60, 5),
        ('task', 'Aufgabe', '', '{title}', '#607D8B', 'task', 5, 60, 6),
        ('project', 'Projekt', '', '{title}', '#795548', 'project', 0, 60, 7)
    """)


def downgrade():
    op.drop_table('pps_todo_type_config')
