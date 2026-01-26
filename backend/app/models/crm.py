"""
CRM (Customer Relationship Management) Models

Contains all models for CRM communication module:
- CRMMailbox: Email account configuration for IMAP/SMTP
- CRMCommunicationEntry: Emails, calls, meetings, notes
- CRMCommunicationAttachment: File attachments
- CRMCommunicationLink: Links to ERP documents
- CRMTag: Tags for customers/leads
- CRMCustomerTag: N:M customer-tag relationship
- CRMLead: Lead/Chance pipeline
- CRMLeadTag: N:M lead-tag relationship
- CRMTask: Tasks and reminders
- CRMEmailTemplate: Email templates
- CRMUserSignature: User email signatures
- CRMAssignmentRule: Auto-assignment rules
- CRMAuditLog: Change tracking
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime, Date, Time, JSON, Numeric, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.mysql import LONGTEXT
from datetime import datetime
from app.core.database import Base


class CRMMailbox(Base):
    """Email account configuration for IMAP/SMTP sync"""
    __tablename__ = "crm_mailboxes"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email_address = Column(String(255), nullable=False, index=True)
    
    # IMAP settings
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True, default=993)
    imap_use_tls = Column(Boolean, nullable=False, default=True)
    imap_username = Column(String(255), nullable=True)
    imap_password_encrypted = Column(Text, nullable=True)
    
    # SMTP settings
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True, default=587)
    smtp_use_tls = Column(Boolean, nullable=False, default=True)
    smtp_username = Column(String(255), nullable=True)
    smtp_password_encrypted = Column(Text, nullable=True)
    
    # Sync settings
    sync_folders = Column(JSON, nullable=True)  # ['INBOX', 'Sent']
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_uid = Column(Integer, nullable=True)  # For incremental sync
    is_active = Column(Boolean, nullable=False, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    communications = relationship("CRMCommunicationEntry", back_populates="mailbox")


class CRMCommunicationEntry(Base):
    """Communication entry - email, call, meeting, note, document"""
    __tablename__ = "crm_communication_entries"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Type: email_in, email_out, phone, meeting, note, document
    entry_type = Column(String(20), nullable=False, index=True)
    
    # Content
    subject = Column(String(500), nullable=True)
    body_html = Column(LONGTEXT, nullable=True)
    body_text = Column(LONGTEXT, nullable=True)
    
    # Email-specific fields
    sender_email = Column(String(255), nullable=True)
    sender_name = Column(String(255), nullable=True)
    recipient_emails = Column(JSON, nullable=True)  # Array of recipients
    cc_emails = Column(JSON, nullable=True)
    bcc_emails = Column(JSON, nullable=True)
    
    # IMAP identifiers for deduplication and threading
    message_id = Column(String(255), nullable=True, unique=True, index=True)
    in_reply_to = Column(String(255), nullable=True)
    references_header = Column(Text, nullable=True)
    thread_id = Column(String(255), nullable=True, index=True)
    
    # Mailbox reference
    mailbox_id = Column(Integer, ForeignKey("crm_mailboxes.id", ondelete="SET NULL"), nullable=True)
    
    # Flags
    is_internal = Column(Boolean, nullable=False, default=False)  # Internal note
    is_read = Column(Boolean, nullable=False, default=False)
    
    # Assignment to ERP entities
    erp_customer_id = Column(Integer, nullable=True, index=True)  # HUGWAWI customer.id
    erp_supplier_id = Column(Integer, nullable=True, index=True)  # HUGWAWI supplier.id
    erp_contact_id = Column(Integer, nullable=True)  # HUGWAWI contact.id
    
    # Auto-assignment metadata
    assignment_confidence = Column(Float, nullable=True)  # 0.0-1.0
    is_auto_assigned = Column(Boolean, nullable=False, default=False)
    
    # Audit
    created_by_user_id = Column(Integer, nullable=True)
    communication_date = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    mailbox = relationship("CRMMailbox", back_populates="communications")
    attachments = relationship("CRMCommunicationAttachment", back_populates="communication", cascade="all, delete-orphan")
    links = relationship("CRMCommunicationLink", back_populates="communication", cascade="all, delete-orphan")
    tasks = relationship("CRMTask", back_populates="communication")
    
    def to_timeline_entry(self):
        """Convert to timeline entry format"""
        return {
            "id": self.id,
            "type": self.entry_type,
            "subject": self.subject,
            "body_preview": (self.body_text or "")[:200] if self.body_text else None,
            "sender": self.sender_name or self.sender_email,
            "date": self.communication_date.isoformat() if self.communication_date else None,
            "is_internal": self.is_internal,
            "has_attachments": len(self.attachments) > 0 if self.attachments else False,
            "attachment_count": len(self.attachments) if self.attachments else 0,
        }


class CRMCommunicationAttachment(Base):
    """File attachment for communication entries"""
    __tablename__ = "crm_communication_attachments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    communication_id = Column(Integer, ForeignKey("crm_communication_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    storage_path = Column(String(500), nullable=False)  # Path in filesystem
    checksum = Column(String(64), nullable=True)  # SHA256
    
    # For inline attachments (embedded images)
    is_inline = Column(Boolean, nullable=False, default=False)
    content_id = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    communication = relationship("CRMCommunicationEntry", back_populates="attachments")


class CRMCommunicationLink(Base):
    """Link between communication and ERP documents"""
    __tablename__ = "crm_communication_links"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    communication_id = Column(Integer, ForeignKey("crm_communication_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Link type: inquiry, offer, order, purchase_order, delivery_note, invoice
    link_type = Column(String(30), nullable=False)
    erp_document_id = Column(Integer, nullable=False)  # ID from HUGWAWI
    erp_document_number = Column(String(50), nullable=True)  # e.g., "AU-2026-00001"
    
    # Assignment metadata
    is_auto_assigned = Column(Boolean, nullable=False, default=False)
    assigned_by_user_id = Column(Integer, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    communication = relationship("CRMCommunicationEntry", back_populates="links")


class CRMTag(Base):
    """Tags for categorizing customers and leads"""
    __tablename__ = "crm_tags"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    color = Column(String(7), nullable=True)  # Hex color like #FF5733
    tag_type = Column(String(20), nullable=False, default="other")  # industry, rating, region, other
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    customer_tags = relationship("CRMCustomerTag", back_populates="tag", cascade="all, delete-orphan")
    lead_tags = relationship("CRMLeadTag", back_populates="tag", cascade="all, delete-orphan")


class CRMCustomerTag(Base):
    """N:M relationship between customers and tags"""
    __tablename__ = "crm_customer_tags"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    erp_customer_id = Column(Integer, nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("crm_tags.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tag = relationship("CRMTag", back_populates="customer_tags")


class CRMLead(Base):
    """Lead/Chance in the sales pipeline"""
    __tablename__ = "crm_leads"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Customer reference (can be null for new prospects)
    erp_customer_id = Column(Integer, nullable=True, index=True)
    customer_name = Column(String(255), nullable=True)  # For leads without ERP customer
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    # Pipeline status: new, qualified, proposal, negotiation, won, lost
    status = Column(String(20), nullable=False, default="new", index=True)
    lost_reason = Column(String(500), nullable=True)
    
    # Value and timing
    expected_value = Column(Numeric(15, 2), nullable=True)
    expected_close_date = Column(Date, nullable=True)
    
    # Assignment
    assigned_employee_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # After conversion to ERP offer
    erp_offer_id = Column(Integer, nullable=True)
    
    # Source: Trade show, Website, Referral, etc.
    source = Column(String(100), nullable=True)
    priority = Column(Integer, nullable=False, default=50)
    
    # Audit
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assigned_employee = relationship("PPSResourceCache", foreign_keys=[assigned_employee_id])
    tags = relationship("CRMLeadTag", back_populates="lead", cascade="all, delete-orphan")
    tasks = relationship("CRMTask", back_populates="lead")


class CRMLeadTag(Base):
    """N:M relationship between leads and tags"""
    __tablename__ = "crm_lead_tags"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("crm_tags.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    lead = relationship("CRMLead", back_populates="tags")
    tag = relationship("CRMTag", back_populates="lead_tags")


class CRMTask(Base):
    """Task or reminder (follow-up, call, meeting, etc.)"""
    __tablename__ = "crm_tasks"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Type: follow_up, call, meeting, internal, reminder
    task_type = Column(String(20), nullable=False, default="internal")
    
    # Status: open, in_progress, completed, cancelled
    status = Column(String(20), nullable=False, default="open", index=True)
    priority = Column(Integer, nullable=False, default=50)  # 1=highest, 100=lowest
    
    # Timing
    due_date = Column(Date, nullable=True, index=True)
    due_time = Column(Time, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Assignment
    assigned_user_id = Column(Integer, nullable=True)
    assigned_employee_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_user_id = Column(Integer, nullable=True)
    
    # Related entities
    erp_customer_id = Column(Integer, nullable=True, index=True)
    erp_supplier_id = Column(Integer, nullable=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True)
    communication_id = Column(Integer, ForeignKey("crm_communication_entries.id", ondelete="SET NULL"), nullable=True)
    
    # Link to ERP document
    link_type = Column(String(30), nullable=True)  # offer, order, etc.
    erp_document_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assigned_employee = relationship("PPSResourceCache", foreign_keys=[assigned_employee_id])
    lead = relationship("CRMLead", back_populates="tasks")
    communication = relationship("CRMCommunicationEntry", back_populates="tasks")
    
    def is_overdue(self):
        """Check if task is overdue"""
        if self.status in ("completed", "cancelled"):
            return False
        if not self.due_date:
            return False
        from datetime import date
        return self.due_date < date.today()


class CRMEmailTemplate(Base):
    """Email template with variables"""
    __tablename__ = "crm_email_templates"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    language = Column(String(5), nullable=False, default="de")  # de, en
    subject_template = Column(String(500), nullable=True)
    body_template = Column(LONGTEXT, nullable=True)
    template_type = Column(String(30), nullable=False, default="general")  # offer, follow_up, general
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def render(self, variables: dict) -> tuple:
        """Render template with variables, returns (subject, body)"""
        subject = self.subject_template or ""
        body = self.body_template or ""
        
        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            subject = subject.replace(placeholder, str(value) if value else "")
            body = body.replace(placeholder, str(value) if value else "")
        
        return subject, body


class CRMUserSignature(Base):
    """User email signature"""
    __tablename__ = "crm_user_signatures"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    language = Column(String(5), nullable=False, default="de")
    signature_html = Column(Text, nullable=True)
    signature_text = Column(Text, nullable=True)
    is_default = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CRMAssignmentRule(Base):
    """Rule for automatic email/communication assignment"""
    __tablename__ = "crm_assignment_rules"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Rule type: email_domain, document_pattern
    rule_type = Column(String(30), nullable=False)
    pattern = Column(String(255), nullable=False)  # Domain or regex pattern
    
    # Target: customer, supplier, document
    target_type = Column(String(30), nullable=False)
    erp_target_id = Column(Integer, nullable=True)  # ERP ID to assign to
    document_type = Column(String(30), nullable=True)  # For document patterns
    
    priority = Column(Integer, nullable=False, default=100)  # Lower = higher priority
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CRMAuditLog(Base):
    """Audit log for CRM changes"""
    __tablename__ = "crm_audit_log"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)  # communication, lead, task, etc.
    entity_id = Column(Integer, nullable=True)
    action = Column(String(50), nullable=False)  # create, update, delete, assign, unassign
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    user_id = Column(Integer, nullable=True)
    user_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
