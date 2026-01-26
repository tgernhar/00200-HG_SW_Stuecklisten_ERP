"""
CRM Email Service

Handles IMAP email synchronization and SMTP sending.
Features:
- IMAP mailbox connection and sync
- Email parsing (headers, body, attachments)
- SMTP email sending with templates
- Deduplication via Message-ID
- Incremental sync via IMAP UID
"""
import imaplib
import smtplib
import email
from email import policy
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import parseaddr, parsedate_to_datetime
from email.header import decode_header
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import hashlib
import os
import re
import uuid
from pathlib import Path

from sqlalchemy.orm import Session
from app.models.crm import (
    CRMMailbox, CRMCommunicationEntry, CRMCommunicationAttachment,
    CRMEmailTemplate, CRMUserSignature, CRMAuditLog
)
from app.core.config import settings


# Attachment storage directory
ATTACHMENT_STORAGE_DIR = os.environ.get("CRM_ATTACHMENT_DIR", "/app/data/crm_attachments")


class EmailSyncResult:
    """Result of email sync operation"""
    def __init__(self):
        self.success = False
        self.new_emails = 0
        self.updated_emails = 0
        self.errors: List[str] = []
        self.last_sync_at: Optional[datetime] = None


class EmailSendResult:
    """Result of email send operation"""
    def __init__(self):
        self.success = False
        self.message_id: Optional[str] = None
        self.communication_id: Optional[int] = None
        self.error: Optional[str] = None


def decode_email_header(header_value: str) -> str:
    """Decode email header handling different encodings"""
    if not header_value:
        return ""
    
    decoded_parts = []
    for part, charset in decode_header(header_value):
        if isinstance(part, bytes):
            try:
                decoded_parts.append(part.decode(charset or 'utf-8', errors='replace'))
            except:
                decoded_parts.append(part.decode('utf-8', errors='replace'))
        else:
            decoded_parts.append(part)
    
    return ' '.join(decoded_parts)


def extract_email_addresses(header_value: str) -> List[str]:
    """Extract email addresses from header (To, Cc, etc.)"""
    if not header_value:
        return []
    
    # Handle multiple addresses separated by comma
    addresses = []
    for part in header_value.split(','):
        name, addr = parseaddr(part.strip())
        if addr:
            addresses.append(addr.lower())
    
    return addresses


def get_email_body(msg: email.message.EmailMessage) -> Tuple[Optional[str], Optional[str]]:
    """Extract HTML and plain text body from email message"""
    html_body = None
    text_body = None
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            
            # Skip attachments
            if "attachment" in content_disposition:
                continue
            
            try:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    decoded = payload.decode(charset, errors='replace')
                    
                    if content_type == "text/html":
                        html_body = decoded
                    elif content_type == "text/plain":
                        text_body = decoded
            except Exception:
                continue
    else:
        content_type = msg.get_content_type()
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or 'utf-8'
                decoded = payload.decode(charset, errors='replace')
                
                if content_type == "text/html":
                    html_body = decoded
                else:
                    text_body = decoded
        except Exception:
            pass
    
    return html_body, text_body


def save_attachment(
    communication_id: int,
    filename: str,
    content: bytes,
    content_type: str,
    content_id: Optional[str] = None
) -> Tuple[str, str, int]:
    """
    Save attachment to filesystem.
    Returns (storage_path, checksum, file_size)
    """
    # Ensure storage directory exists
    storage_dir = Path(ATTACHMENT_STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    # Create subdirectory for communication
    comm_dir = storage_dir / str(communication_id)
    comm_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    safe_filename = re.sub(r'[^\w\.\-]', '_', filename)
    unique_filename = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
    
    file_path = comm_dir / unique_filename
    
    # Write file
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Calculate checksum
    checksum = hashlib.sha256(content).hexdigest()
    
    return str(file_path), checksum, len(content)


def extract_attachments(
    msg: email.message.EmailMessage,
    communication_id: int,
    db: Session
) -> List[CRMCommunicationAttachment]:
    """Extract and save attachments from email"""
    attachments = []
    
    if not msg.is_multipart():
        return attachments
    
    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", ""))
        content_type = part.get_content_type()
        
        # Check if it's an attachment or inline image
        is_attachment = "attachment" in content_disposition
        is_inline = "inline" in content_disposition
        content_id = part.get("Content-ID", "").strip("<>")
        
        if is_attachment or (is_inline and content_id):
            try:
                filename = part.get_filename()
                if filename:
                    filename = decode_email_header(filename)
                else:
                    # Generate filename for inline attachments
                    ext = content_type.split('/')[-1] if '/' in content_type else 'bin'
                    filename = f"inline_{uuid.uuid4().hex[:8]}.{ext}"
                
                payload = part.get_payload(decode=True)
                if payload:
                    storage_path, checksum, file_size = save_attachment(
                        communication_id, filename, payload, content_type, content_id
                    )
                    
                    attachment = CRMCommunicationAttachment(
                        communication_id=communication_id,
                        filename=filename,
                        original_filename=filename,
                        content_type=content_type,
                        file_size=file_size,
                        storage_path=storage_path,
                        checksum=checksum,
                        is_inline=is_inline,
                        content_id=content_id if content_id else None,
                        created_at=datetime.utcnow(),
                    )
                    db.add(attachment)
                    attachments.append(attachment)
                    
            except Exception as e:
                print(f"Error extracting attachment: {e}")
                continue
    
    return attachments


def connect_imap(mailbox: CRMMailbox) -> imaplib.IMAP4_SSL:
    """Connect to IMAP server"""
    if mailbox.imap_use_tls:
        imap = imaplib.IMAP4_SSL(mailbox.imap_host, mailbox.imap_port or 993)
    else:
        imap = imaplib.IMAP4(mailbox.imap_host, mailbox.imap_port or 143)
    
    # Login with decrypted password
    # TODO: Implement proper password decryption
    password = mailbox.imap_password_encrypted  # For now, assume plaintext
    imap.login(mailbox.imap_username, password)
    
    return imap


def sync_mailbox(db: Session, mailbox_id: int, full_sync: bool = False) -> EmailSyncResult:
    """
    Synchronize emails from IMAP mailbox.
    
    Args:
        db: Database session
        mailbox_id: ID of mailbox to sync
        full_sync: If True, ignore last_sync_uid and sync all emails
    
    Returns:
        EmailSyncResult with sync statistics
    """
    result = EmailSyncResult()
    
    try:
        # Get mailbox config
        mailbox = db.query(CRMMailbox).filter(CRMMailbox.id == mailbox_id).first()
        if not mailbox:
            result.errors.append("Mailbox nicht gefunden")
            return result
        
        if not mailbox.is_active:
            result.errors.append("Mailbox ist deaktiviert")
            return result
        
        # Connect to IMAP
        imap = connect_imap(mailbox)
        
        # Get folders to sync
        folders = mailbox.sync_folders or ["INBOX", "Sent"]
        
        for folder in folders:
            try:
                imap.select(folder, readonly=True)
                
                # Determine search criteria
                if full_sync or not mailbox.last_sync_uid:
                    # Full sync - get all emails
                    status, messages = imap.search(None, "ALL")
                else:
                    # Incremental sync - get new emails since last UID
                    status, messages = imap.uid('search', None, f'UID {mailbox.last_sync_uid}:*')
                
                if status != "OK":
                    result.errors.append(f"Fehler beim Suchen in {folder}")
                    continue
                
                message_nums = messages[0].split()
                
                for num in message_nums:
                    try:
                        # Fetch email
                        if full_sync or not mailbox.last_sync_uid:
                            status, data = imap.fetch(num, "(RFC822 UID)")
                        else:
                            status, data = imap.uid('fetch', num, "(RFC822)")
                        
                        if status != "OK":
                            continue
                        
                        # Parse email
                        raw_email = data[0][1]
                        msg = email.message_from_bytes(raw_email, policy=policy.default)
                        
                        # Extract Message-ID for deduplication
                        message_id = msg.get("Message-ID", "").strip("<>")
                        if not message_id:
                            message_id = f"no-id-{hashlib.md5(raw_email).hexdigest()}"
                        
                        # Check if already exists
                        existing = db.query(CRMCommunicationEntry).filter(
                            CRMCommunicationEntry.message_id == message_id
                        ).first()
                        
                        if existing:
                            continue
                        
                        # Extract email data
                        subject = decode_email_header(msg.get("Subject", ""))
                        from_header = msg.get("From", "")
                        sender_name, sender_email = parseaddr(from_header)
                        sender_name = decode_email_header(sender_name)
                        
                        to_emails = extract_email_addresses(msg.get("To", ""))
                        cc_emails = extract_email_addresses(msg.get("Cc", ""))
                        bcc_emails = extract_email_addresses(msg.get("Bcc", ""))
                        
                        # Get body
                        html_body, text_body = get_email_body(msg)
                        
                        # Parse date
                        date_header = msg.get("Date")
                        try:
                            comm_date = parsedate_to_datetime(date_header) if date_header else datetime.utcnow()
                        except:
                            comm_date = datetime.utcnow()
                        
                        # Get threading info
                        in_reply_to = msg.get("In-Reply-To", "").strip("<>")
                        references = msg.get("References", "")
                        
                        # Determine entry type
                        is_sent = folder.lower() in ["sent", "gesendet", "sent items"]
                        entry_type = "email_out" if is_sent else "email_in"
                        
                        # Create communication entry
                        comm = CRMCommunicationEntry(
                            entry_type=entry_type,
                            subject=subject,
                            body_html=html_body,
                            body_text=text_body,
                            sender_email=sender_email.lower() if sender_email else None,
                            sender_name=sender_name,
                            recipient_emails=to_emails,
                            cc_emails=cc_emails,
                            bcc_emails=bcc_emails,
                            message_id=message_id,
                            in_reply_to=in_reply_to if in_reply_to else None,
                            references_header=references if references else None,
                            mailbox_id=mailbox_id,
                            is_internal=False,
                            is_read=False,
                            communication_date=comm_date,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow(),
                        )
                        
                        db.add(comm)
                        db.flush()  # Get ID for attachments
                        
                        # Extract and save attachments
                        extract_attachments(msg, comm.id, db)
                        
                        result.new_emails += 1
                        
                    except Exception as e:
                        result.errors.append(f"Fehler bei E-Mail: {str(e)}")
                        continue
                
            except Exception as e:
                result.errors.append(f"Fehler beim Sync von {folder}: {str(e)}")
                continue
        
        # Update mailbox sync timestamp
        mailbox.last_sync_at = datetime.utcnow()
        db.commit()
        
        imap.logout()
        
        result.success = True
        result.last_sync_at = mailbox.last_sync_at
        
    except Exception as e:
        result.errors.append(f"IMAP-Verbindungsfehler: {str(e)}")
        db.rollback()
    
    return result


def send_email(
    db: Session,
    mailbox_id: int,
    to_emails: List[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    cc_emails: Optional[List[str]] = None,
    bcc_emails: Optional[List[str]] = None,
    erp_customer_id: Optional[int] = None,
    erp_supplier_id: Optional[int] = None,
    attachment_paths: Optional[List[str]] = None,
    user_signature_id: Optional[int] = None,
) -> EmailSendResult:
    """
    Send email via SMTP and store as communication entry.
    
    Args:
        db: Database session
        mailbox_id: ID of mailbox to send from
        to_emails: List of recipient email addresses
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body (optional)
        cc_emails: CC recipients (optional)
        bcc_emails: BCC recipients (optional)
        erp_customer_id: Link to HUGWAWI customer (optional)
        erp_supplier_id: Link to HUGWAWI supplier (optional)
        attachment_paths: Paths to files to attach (optional)
        user_signature_id: ID of signature to append (optional)
    
    Returns:
        EmailSendResult with send status
    """
    result = EmailSendResult()
    
    try:
        # Get mailbox config
        mailbox = db.query(CRMMailbox).filter(CRMMailbox.id == mailbox_id).first()
        if not mailbox:
            result.error = "Mailbox nicht gefunden"
            return result
        
        if not mailbox.smtp_host:
            result.error = "SMTP nicht konfiguriert"
            return result
        
        # Append signature if requested
        if user_signature_id:
            signature = db.query(CRMUserSignature).filter(
                CRMUserSignature.id == user_signature_id
            ).first()
            if signature:
                if signature.signature_html and body_html:
                    body_html = body_html + "<br><br>" + signature.signature_html
                if signature.signature_text and body_text:
                    body_text = body_text + "\n\n" + signature.signature_text
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = mailbox.email_address
        msg['To'] = ', '.join(to_emails)
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        # Generate Message-ID
        message_id = f"<{uuid.uuid4().hex}@{mailbox.email_address.split('@')[1]}>"
        msg['Message-ID'] = message_id
        msg['Date'] = email.utils.formatdate(localtime=True)
        
        # Add body parts
        if body_text:
            msg.attach(MIMEText(body_text, 'plain', 'utf-8'))
        msg.attach(MIMEText(body_html, 'html', 'utf-8'))
        
        # Add attachments
        if attachment_paths:
            for path in attachment_paths:
                if os.path.exists(path):
                    with open(path, 'rb') as f:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                        encoders.encode_base64(part)
                        part.add_header(
                            'Content-Disposition',
                            f'attachment; filename="{os.path.basename(path)}"'
                        )
                        msg.attach(part)
        
        # Get all recipients for SMTP
        all_recipients = list(to_emails)
        if cc_emails:
            all_recipients.extend(cc_emails)
        if bcc_emails:
            all_recipients.extend(bcc_emails)
        
        # Connect and send
        # TODO: Implement proper password decryption
        password = mailbox.smtp_password_encrypted
        
        if mailbox.smtp_use_tls:
            smtp = smtplib.SMTP(mailbox.smtp_host, mailbox.smtp_port or 587)
            smtp.starttls()
        else:
            smtp = smtplib.SMTP(mailbox.smtp_host, mailbox.smtp_port or 25)
        
        if mailbox.smtp_username and password:
            smtp.login(mailbox.smtp_username, password)
        
        smtp.sendmail(mailbox.email_address, all_recipients, msg.as_string())
        smtp.quit()
        
        # Store as communication entry
        comm = CRMCommunicationEntry(
            entry_type="email_out",
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            sender_email=mailbox.email_address,
            recipient_emails=to_emails,
            cc_emails=cc_emails,
            bcc_emails=bcc_emails,
            message_id=message_id.strip("<>"),
            mailbox_id=mailbox_id,
            is_internal=False,
            is_read=True,
            erp_customer_id=erp_customer_id,
            erp_supplier_id=erp_supplier_id,
            communication_date=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        db.add(comm)
        db.commit()
        db.refresh(comm)
        
        result.success = True
        result.message_id = message_id.strip("<>")
        result.communication_id = comm.id
        
    except smtplib.SMTPAuthenticationError:
        result.error = "SMTP-Authentifizierung fehlgeschlagen"
    except smtplib.SMTPRecipientsRefused:
        result.error = "Empfänger abgelehnt"
    except Exception as e:
        result.error = f"Fehler beim Senden: {str(e)}"
        db.rollback()
    
    return result


def render_template(
    db: Session,
    template_id: int,
    variables: Dict[str, Any]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Render email template with variables.
    
    Args:
        db: Database session
        template_id: ID of template to render
        variables: Dictionary of variables to replace
    
    Returns:
        Tuple of (subject, body) or (None, None) if template not found
    """
    template = db.query(CRMEmailTemplate).filter(CRMEmailTemplate.id == template_id).first()
    if not template:
        return None, None
    
    return template.render(variables)


def get_thread_emails(db: Session, thread_id: str) -> List[CRMCommunicationEntry]:
    """Get all emails in a thread"""
    return db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.thread_id == thread_id
    ).order_by(CRMCommunicationEntry.communication_date).all()


def mark_as_read(db: Session, communication_id: int) -> bool:
    """Mark a communication as read"""
    comm = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.id == communication_id
    ).first()
    
    if not comm:
        return False
    
    comm.is_read = True
    comm.updated_at = datetime.utcnow()
    db.commit()
    
    return True
