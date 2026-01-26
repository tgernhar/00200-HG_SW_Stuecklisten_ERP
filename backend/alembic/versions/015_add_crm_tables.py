"""Add CRM tables for communication module

Revision ID: 015_add_crm_tables
Revises: 014_add_progress_field
Create Date: 2026-01-25

CRM tables for:
- Communication entries (emails, calls, meetings, notes)
- Communication attachments
- Communication links to ERP documents
- Leads/Chances pipeline
- Tasks/Reminders
- Tags for customers
- Mailbox configuration
- Email templates
- Audit logging
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers
revision = '015_add_crm_tables'
down_revision = '014_add_progress_field'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CRM Mailboxes - configured email accounts for IMAP/SMTP
    op.create_table(
        'crm_mailboxes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email_address', sa.String(255), nullable=False),
        sa.Column('imap_host', sa.String(255), nullable=True),
        sa.Column('imap_port', sa.Integer(), nullable=True, default=993),
        sa.Column('imap_use_tls', sa.Boolean(), nullable=False, default=True),
        sa.Column('imap_username', sa.String(255), nullable=True),
        sa.Column('imap_password_encrypted', sa.Text(), nullable=True),
        sa.Column('smtp_host', sa.String(255), nullable=True),
        sa.Column('smtp_port', sa.Integer(), nullable=True, default=587),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=False, default=True),
        sa.Column('smtp_username', sa.String(255), nullable=True),
        sa.Column('smtp_password_encrypted', sa.Text(), nullable=True),
        sa.Column('sync_folders', sa.JSON(), nullable=True),  # ['INBOX', 'Sent']
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_uid', sa.Integer(), nullable=True),  # IMAP UID for incremental sync
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_mailboxes_email_address', 'crm_mailboxes', ['email_address'])

    # CRM Communication Entries - emails, calls, meetings, notes
    op.create_table(
        'crm_communication_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entry_type', sa.String(20), nullable=False),  # email_in, email_out, phone, meeting, note, document
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body_html', mysql.LONGTEXT(), nullable=True),
        sa.Column('body_text', mysql.LONGTEXT(), nullable=True),
        sa.Column('sender_email', sa.String(255), nullable=True),
        sa.Column('sender_name', sa.String(255), nullable=True),
        sa.Column('recipient_emails', sa.JSON(), nullable=True),  # Array of recipients
        sa.Column('cc_emails', sa.JSON(), nullable=True),
        sa.Column('bcc_emails', sa.JSON(), nullable=True),
        sa.Column('message_id', sa.String(255), nullable=True),  # IMAP Message-ID for dedup
        sa.Column('in_reply_to', sa.String(255), nullable=True),
        sa.Column('references_header', sa.Text(), nullable=True),
        sa.Column('thread_id', sa.String(255), nullable=True),  # For grouping conversations
        sa.Column('mailbox_id', sa.Integer(), sa.ForeignKey('crm_mailboxes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_internal', sa.Boolean(), nullable=False, default=False),  # Internal note
        sa.Column('is_read', sa.Boolean(), nullable=False, default=False),
        sa.Column('erp_customer_id', sa.Integer(), nullable=True),  # Reference to HUGWAWI customer.id
        sa.Column('erp_supplier_id', sa.Integer(), nullable=True),  # Reference to HUGWAWI supplier.id
        sa.Column('erp_contact_id', sa.Integer(), nullable=True),  # Reference to HUGWAWI contact.id
        sa.Column('assignment_confidence', sa.Float(), nullable=True),  # 0.0-1.0 confidence score
        sa.Column('is_auto_assigned', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('communication_date', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_comm_message_id', 'crm_communication_entries', ['message_id'], unique=True)
    op.create_index('ix_crm_comm_erp_customer', 'crm_communication_entries', ['erp_customer_id'])
    op.create_index('ix_crm_comm_erp_supplier', 'crm_communication_entries', ['erp_supplier_id'])
    op.create_index('ix_crm_comm_date', 'crm_communication_entries', ['communication_date'])
    op.create_index('ix_crm_comm_type', 'crm_communication_entries', ['entry_type'])
    op.create_index('ix_crm_comm_thread', 'crm_communication_entries', ['thread_id'])

    # CRM Communication Attachments
    op.create_table(
        'crm_communication_attachments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('communication_id', sa.Integer(), sa.ForeignKey('crm_communication_entries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=True),
        sa.Column('content_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('storage_path', sa.String(500), nullable=False),  # Path in filesystem
        sa.Column('checksum', sa.String(64), nullable=True),  # SHA256
        sa.Column('is_inline', sa.Boolean(), nullable=False, default=False),  # Inline attachment (embedded image)
        sa.Column('content_id', sa.String(255), nullable=True),  # For inline attachments
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_attach_comm', 'crm_communication_attachments', ['communication_id'])

    # CRM Communication Links - links to ERP documents
    op.create_table(
        'crm_communication_links',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('communication_id', sa.Integer(), sa.ForeignKey('crm_communication_entries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('link_type', sa.String(30), nullable=False),  # inquiry, offer, order, purchase_order, delivery_note, invoice
        sa.Column('erp_document_id', sa.Integer(), nullable=False),  # ID from HUGWAWI
        sa.Column('erp_document_number', sa.String(50), nullable=True),  # e.g., "AU-2026-00001"
        sa.Column('is_auto_assigned', sa.Boolean(), nullable=False, default=False),
        sa.Column('assigned_by_user_id', sa.Integer(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_links_comm', 'crm_communication_links', ['communication_id'])
    op.create_index('ix_crm_links_doc', 'crm_communication_links', ['link_type', 'erp_document_id'])

    # CRM Tags for customers/leads
    op.create_table(
        'crm_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),  # Hex color like #FF5733
        sa.Column('tag_type', sa.String(20), nullable=False, default='other'),  # industry, rating, region, other
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_tags_name', 'crm_tags', ['name'], unique=True)

    # CRM Customer Tags - N:M relationship
    op.create_table(
        'crm_customer_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('erp_customer_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('crm_tags.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('erp_customer_id', 'tag_id', name='uq_customer_tag')
    )
    op.create_index('ix_crm_custtags_customer', 'crm_customer_tags', ['erp_customer_id'])

    # CRM Leads/Chances Pipeline
    op.create_table(
        'crm_leads',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('erp_customer_id', sa.Integer(), nullable=True),  # Can be null for new prospects
        sa.Column('customer_name', sa.String(255), nullable=True),  # For leads without ERP customer
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, default='new'),  # new, qualified, proposal, negotiation, won, lost
        sa.Column('lost_reason', sa.String(500), nullable=True),
        sa.Column('expected_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('expected_close_date', sa.Date(), nullable=True),
        sa.Column('assigned_employee_id', sa.Integer(), sa.ForeignKey('pps_resource_cache.id', ondelete='SET NULL'), nullable=True),
        sa.Column('erp_offer_id', sa.Integer(), nullable=True),  # After conversion to offer
        sa.Column('source', sa.String(100), nullable=True),  # Trade show, Website, Referral
        sa.Column('priority', sa.Integer(), nullable=False, default=50),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_leads_status', 'crm_leads', ['status'])
    op.create_index('ix_crm_leads_customer', 'crm_leads', ['erp_customer_id'])
    op.create_index('ix_crm_leads_employee', 'crm_leads', ['assigned_employee_id'])

    # CRM Lead Tags - N:M relationship
    op.create_table(
        'crm_lead_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('lead_id', sa.Integer(), sa.ForeignKey('crm_leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('crm_tags.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lead_id', 'tag_id', name='uq_lead_tag')
    )

    # CRM Tasks/Reminders
    op.create_table(
        'crm_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('task_type', sa.String(20), nullable=False, default='internal'),  # follow_up, call, meeting, internal, reminder
        sa.Column('status', sa.String(20), nullable=False, default='open'),  # open, in_progress, completed, cancelled
        sa.Column('priority', sa.Integer(), nullable=False, default=50),  # 1=highest, 100=lowest
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('due_time', sa.Time(), nullable=True),
        sa.Column('assigned_user_id', sa.Integer(), nullable=True),
        sa.Column('assigned_employee_id', sa.Integer(), sa.ForeignKey('pps_resource_cache.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('erp_customer_id', sa.Integer(), nullable=True),
        sa.Column('erp_supplier_id', sa.Integer(), nullable=True),
        sa.Column('lead_id', sa.Integer(), sa.ForeignKey('crm_leads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('communication_id', sa.Integer(), sa.ForeignKey('crm_communication_entries.id', ondelete='SET NULL'), nullable=True),
        sa.Column('link_type', sa.String(30), nullable=True),  # ERP document type
        sa.Column('erp_document_id', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_tasks_status', 'crm_tasks', ['status'])
    op.create_index('ix_crm_tasks_due', 'crm_tasks', ['due_date'])
    op.create_index('ix_crm_tasks_assigned', 'crm_tasks', ['assigned_employee_id'])
    op.create_index('ix_crm_tasks_customer', 'crm_tasks', ['erp_customer_id'])

    # CRM Email Templates
    op.create_table(
        'crm_email_templates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('language', sa.String(5), nullable=False, default='de'),  # de, en
        sa.Column('subject_template', sa.String(500), nullable=True),
        sa.Column('body_template', mysql.LONGTEXT(), nullable=True),
        sa.Column('template_type', sa.String(30), nullable=False, default='general'),  # offer, follow_up, general
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_templates_type', 'crm_email_templates', ['template_type', 'language'])

    # CRM User Signatures
    op.create_table(
        'crm_user_signatures',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(5), nullable=False, default='de'),
        sa.Column('signature_html', sa.Text(), nullable=True),
        sa.Column('signature_text', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_signatures_user', 'crm_user_signatures', ['user_id', 'language'])

    # CRM Assignment Rules - configurable rules for auto-assignment
    op.create_table(
        'crm_assignment_rules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('rule_type', sa.String(30), nullable=False),  # email_domain, document_pattern
        sa.Column('pattern', sa.String(255), nullable=False),  # Domain or regex pattern
        sa.Column('target_type', sa.String(30), nullable=False),  # customer, supplier, document
        sa.Column('erp_target_id', sa.Integer(), nullable=True),  # ERP ID to assign to
        sa.Column('document_type', sa.String(30), nullable=True),  # For document patterns
        sa.Column('priority', sa.Integer(), nullable=False, default=100),  # Lower = higher priority
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_rules_type', 'crm_assignment_rules', ['rule_type', 'is_active'])

    # CRM Audit Log
    op.create_table(
        'crm_audit_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),  # communication, lead, task, etc.
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),  # create, update, delete, assign, unassign
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crm_audit_entity', 'crm_audit_log', ['entity_type', 'entity_id'])
    op.create_index('ix_crm_audit_date', 'crm_audit_log', ['created_at'])


def downgrade() -> None:
    op.drop_table('crm_audit_log')
    op.drop_table('crm_assignment_rules')
    op.drop_table('crm_user_signatures')
    op.drop_table('crm_email_templates')
    op.drop_table('crm_tasks')
    op.drop_table('crm_lead_tags')
    op.drop_table('crm_leads')
    op.drop_table('crm_customer_tags')
    op.drop_table('crm_tags')
    op.drop_table('crm_communication_links')
    op.drop_table('crm_communication_attachments')
    op.drop_table('crm_communication_entries')
    op.drop_table('crm_mailboxes')
