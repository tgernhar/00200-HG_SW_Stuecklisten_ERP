"""Extend CRM communication links with order_article, bom_item, operation references

Revision ID: 022
Revises: 021
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    """Add extended link columns to crm_communication_links"""
    
    # Add new columns for ERP references
    op.add_column('crm_communication_links', 
                  sa.Column('erp_order_article_id', sa.Integer(), nullable=True))
    op.add_column('crm_communication_links', 
                  sa.Column('erp_bom_item_id', sa.Integer(), nullable=True))
    op.add_column('crm_communication_links', 
                  sa.Column('erp_operation_id', sa.Integer(), nullable=True))
    
    # Add new columns for local DB references
    op.add_column('crm_communication_links', 
                  sa.Column('local_article_id', sa.Integer(), nullable=True))
    op.add_column('crm_communication_links', 
                  sa.Column('local_pps_todo_id', sa.Integer(), nullable=True))
    
    # Create indexes for new columns
    op.create_index('ix_crm_communication_links_erp_order_article_id', 
                    'crm_communication_links', ['erp_order_article_id'])
    op.create_index('ix_crm_communication_links_erp_bom_item_id', 
                    'crm_communication_links', ['erp_bom_item_id'])
    op.create_index('ix_crm_communication_links_erp_operation_id', 
                    'crm_communication_links', ['erp_operation_id'])
    op.create_index('ix_crm_communication_links_local_article_id', 
                    'crm_communication_links', ['local_article_id'])
    op.create_index('ix_crm_communication_links_local_pps_todo_id', 
                    'crm_communication_links', ['local_pps_todo_id'])
    
    # Create foreign key constraints for local references
    op.create_foreign_key(
        'fk_crm_comm_links_local_article',
        'crm_communication_links', 'articles',
        ['local_article_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_crm_comm_links_local_pps_todo',
        'crm_communication_links', 'pps_todos',
        ['local_pps_todo_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Make erp_document_id nullable (it was NOT NULL before, but now we have alternative links)
    op.alter_column('crm_communication_links', 'erp_document_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade():
    """Remove extended link columns from crm_communication_links"""
    
    # Drop foreign keys
    op.drop_constraint('fk_crm_comm_links_local_article', 'crm_communication_links', type_='foreignkey')
    op.drop_constraint('fk_crm_comm_links_local_pps_todo', 'crm_communication_links', type_='foreignkey')
    
    # Drop indexes
    op.drop_index('ix_crm_communication_links_erp_order_article_id', 'crm_communication_links')
    op.drop_index('ix_crm_communication_links_erp_bom_item_id', 'crm_communication_links')
    op.drop_index('ix_crm_communication_links_erp_operation_id', 'crm_communication_links')
    op.drop_index('ix_crm_communication_links_local_article_id', 'crm_communication_links')
    op.drop_index('ix_crm_communication_links_local_pps_todo_id', 'crm_communication_links')
    
    # Drop columns
    op.drop_column('crm_communication_links', 'erp_order_article_id')
    op.drop_column('crm_communication_links', 'erp_bom_item_id')
    op.drop_column('crm_communication_links', 'erp_operation_id')
    op.drop_column('crm_communication_links', 'local_article_id')
    op.drop_column('crm_communication_links', 'local_pps_todo_id')
    
    # Make erp_document_id NOT NULL again
    op.alter_column('crm_communication_links', 'erp_document_id',
                    existing_type=sa.Integer(),
                    nullable=False)
