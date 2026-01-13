"""Initial migration

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('au_nr', sa.String(length=100), nullable=False),
        sa.Column('project_path', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)
    op.create_index(op.f('ix_projects_au_nr'), 'projects', ['au_nr'], unique=True)

    # Create articles table
    op.create_table(
        'articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('pos_nr', sa.Integer(), nullable=True),
        sa.Column('hg_artikelnummer', sa.String(length=100), nullable=True),
        sa.Column('benennung', sa.String(length=500), nullable=True),
        sa.Column('konfiguration', sa.String(length=200), nullable=True),
        sa.Column('teilenummer', sa.String(length=100), nullable=True),
        sa.Column('menge', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('teiletyp_fertigungsplan', sa.String(length=150), nullable=True),
        sa.Column('abteilung_lieferant', sa.String(length=150), nullable=True),
        sa.Column('werkstoff', sa.String(length=150), nullable=True),
        sa.Column('werkstoff_nr', sa.String(length=150), nullable=True),
        sa.Column('oberflaeche', sa.String(length=150), nullable=True),
        sa.Column('oberflaechenschutz', sa.String(length=150), nullable=True),
        sa.Column('farbe', sa.String(length=150), nullable=True),
        sa.Column('lieferzeit', sa.String(length=150), nullable=True),
        sa.Column('laenge', sa.Float(), nullable=True),
        sa.Column('breite', sa.Float(), nullable=True),
        sa.Column('hoehe', sa.Float(), nullable=True),
        sa.Column('gewicht', sa.Float(), nullable=True),
        sa.Column('pfad', sa.String(length=500), nullable=True),
        sa.Column('sldasm_sldprt_pfad', sa.String(length=500), nullable=True),
        sa.Column('slddrw_pfad', sa.String(length=500), nullable=True),
        sa.Column('in_stueckliste_anzeigen', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('erp_exists', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_articles_id'), 'articles', ['id'], unique=False)
    op.create_index(op.f('ix_articles_hg_artikelnummer'), 'articles', ['hg_artikelnummer'], unique=False)

    # Create orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('hg_bnr', sa.String(length=100), nullable=True),
        sa.Column('bnr_status', sa.String(length=50), nullable=True),
        sa.Column('bnr_menge', sa.Integer(), nullable=True),
        sa.Column('bestellkommentar', sa.String(length=500), nullable=True),
        sa.Column('hg_lt', sa.Date(), nullable=True),
        sa.Column('bestaetigter_lt', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_id'), 'orders', ['id'], unique=False)

    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('exists', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)

    # Create document_generation_flags table
    op.create_table(
        'document_generation_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('pdf_drucken', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('pdf', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('pdf_bestell_pdf', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('dxf', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('bestell_dxf', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('step', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('x_t', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('stl', sa.String(length=1), nullable=True, server_default=''),
        sa.Column('bn_ab', sa.String(length=1), nullable=True, server_default=''),
        sa.ForeignKeyConstraint(['article_id'], ['articles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('article_id')
    )
    op.create_index(op.f('ix_document_generation_flags_id'), 'document_generation_flags', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_document_generation_flags_id'), table_name='document_generation_flags')
    op.drop_table('document_generation_flags')
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    op.drop_table('documents')
    op.drop_index(op.f('ix_orders_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_articles_hg_artikelnummer'), table_name='articles')
    op.drop_index(op.f('ix_articles_id'), table_name='articles')
    op.drop_table('articles')
    op.drop_index(op.f('ix_projects_au_nr'), table_name='projects')
    op.drop_index(op.f('ix_projects_id'), table_name='projects')
    op.drop_table('projects')
