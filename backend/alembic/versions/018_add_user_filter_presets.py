"""Add pps_user_filter_presets table for persistent filter settings

Revision ID: 018_add_user_filter_presets
Revises: 017_add_entity_images
Create Date: 2026-01-28

Stores user-specific filter presets for PPS pages (TodoListPage, Planboard, etc.)
Each user can have multiple presets per page, with one marked as favorite.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '018_add_user_filter_presets'
down_revision = '017_add_entity_images'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'pps_user_filter_presets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),  # userlogin.id
        sa.Column('name', sa.String(100), nullable=False),  # Preset name
        sa.Column('page', sa.String(50), nullable=False),  # "todo_list", "planboard", etc.
        sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default='0'),  # Load on page open
        sa.Column('filter_config', sa.JSON(), nullable=False),  # Serialized filter settings
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create index for faster lookups by user and page
    op.create_index(
        'idx_user_filter_page',
        'pps_user_filter_presets',
        ['user_id', 'page'],
        unique=False
    )
    
    # Create index for finding favorites quickly
    op.create_index(
        'idx_user_filter_favorite',
        'pps_user_filter_presets',
        ['user_id', 'page', 'is_favorite'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_user_filter_favorite', table_name='pps_user_filter_presets')
    op.drop_index('idx_user_filter_page', table_name='pps_user_filter_presets')
    op.drop_table('pps_user_filter_presets')
