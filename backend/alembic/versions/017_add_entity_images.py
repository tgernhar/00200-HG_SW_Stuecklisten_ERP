"""Add entity_images table for universal image management

Revision ID: 017
Revises: 016_add_resource_level
Create Date: 2026-01-25

Adds entity_images table to store thumbnail previews as BLOBs and reference
original files via filepath. Used for articles, BOM items, and worksteps.

Thumbnail sizes:
- small: 150x150px (5-15 KB) - grid cells, list views
- medium: 300x300px (15-40 KB) - dialog preview (default)
- large: 600x600px (40-100 KB) - print preview
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_add_entity_images'
down_revision = '016_add_resource_level'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'entity_images',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),  # "article", "bom_item", "workstep"
        sa.Column('entity_id', sa.Integer(), nullable=True),  # Reference ID (e.g., HUGWAWI article.id)
        sa.Column('entity_reference', sa.String(255), nullable=True),  # Alternative reference (e.g., article number)
        sa.Column('original_filepath', sa.String(500), nullable=False),  # Full path to original file
        sa.Column('original_filename', sa.String(255), nullable=True),  # Original filename
        sa.Column('file_type', sa.String(10), nullable=True),  # "pdf", "png", "jpg", "jpeg"
        sa.Column('thumbnail_size', sa.String(10), nullable=True, default='medium'),  # "small", "medium", "large"
        sa.Column('thumbnail_blob', sa.LargeBinary(length=16777215), nullable=True),  # MEDIUMBLOB for thumbnail
        sa.Column('thumbnail_width', sa.Integer(), nullable=True),
        sa.Column('thumbnail_height', sa.Integer(), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),  # userlogin.id
        sa.Column('uploaded_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create index for faster lookups by entity type and id
    op.create_index(
        'idx_entity_lookup',
        'entity_images',
        ['entity_type', 'entity_id'],
        unique=False
    )
    
    # Create index for alternative reference lookup
    op.create_index(
        'idx_entity_reference',
        'entity_images',
        ['entity_type', 'entity_reference'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_entity_reference', table_name='entity_images')
    op.drop_index('idx_entity_lookup', table_name='entity_images')
    op.drop_table('entity_images')
