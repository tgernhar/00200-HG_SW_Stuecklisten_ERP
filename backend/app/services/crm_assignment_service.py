"""
CRM Auto-Assignment Service

Automatically assigns emails to customers/suppliers and ERP documents.
Features:
- Email address to customer/supplier matching
- Document number extraction from subject/body
- Configurable assignment rules
- Confidence scoring
"""
import re
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.crm import (
    CRMCommunicationEntry, CRMCommunicationLink, CRMAssignmentRule, CRMAuditLog
)
from app.core.database import get_erp_db_connection


@dataclass
class AssignmentSuggestion:
    """Suggested assignment for a communication"""
    target_type: str  # 'customer', 'supplier', 'document'
    erp_id: int
    name: str
    confidence: float  # 0.0 - 1.0
    reason: str


@dataclass
class DocumentMatch:
    """Matched document reference in email"""
    document_type: str  # 'offer', 'order', 'purchase_order', 'delivery_note', 'invoice'
    document_number: str
    erp_id: Optional[int]
    confidence: float


# Document number patterns
# These patterns match common German business document numbering formats
DOCUMENT_PATTERNS = [
    # Angebot (Offer)
    (r'ANG[.-]?\d{4}[.-]\d+', 'offer'),
    (r'Angebot[:\s]*[#]?(\d+)', 'offer'),
    (r'Angebot\s+Nr\.?\s*[:]?\s*(\w+[-/]\d+)', 'offer'),
    
    # Auftrag (Order)
    (r'AU[.-]?\d{4}[.-]\d+', 'order'),
    (r'Auftrag[:\s]*[#]?(\d+)', 'order'),
    (r'Auftragsnummer[:\s]*(\w+[-/]\d+)', 'order'),
    (r'Bestell(?:ung)?[:\s]*[#]?(\d+)', 'order'),
    
    # Bestellnummer (Purchase Order)
    (r'BN[.-]?\d{4}[.-]\d+', 'purchase_order'),
    (r'Bestellung[:\s]*[#]?(\d+)', 'purchase_order'),
    
    # Lieferschein (Delivery Note)
    (r'LN[.-]?\d{4}[.-]\d+', 'delivery_note'),
    (r'Lieferschein[:\s]*[#]?(\d+)', 'delivery_note'),
    (r'LS[.-]?\d{4}[.-]\d+', 'delivery_note'),
    
    # Rechnung (Invoice)
    (r'Re[.-]?\d{4}[.-]\d+', 'invoice'),
    (r'Rechnung[:\s]*[#]?(\d+)', 'invoice'),
    (r'Invoice[:\s]*[#]?(\d+)', 'invoice'),
    (r'RG[.-]?\d{4}[.-]\d+', 'invoice'),
]


def extract_document_references(text: str) -> List[DocumentMatch]:
    """
    Extract document references from email subject/body.
    
    Args:
        text: Text to search (subject + body)
    
    Returns:
        List of DocumentMatch objects
    """
    if not text:
        return []
    
    matches = []
    seen = set()  # Avoid duplicates
    
    for pattern, doc_type in DOCUMENT_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            doc_number = match.group(0)
            
            # Normalize document number
            doc_number = doc_number.upper().strip()
            
            if doc_number not in seen:
                seen.add(doc_number)
                matches.append(DocumentMatch(
                    document_type=doc_type,
                    document_number=doc_number,
                    erp_id=None,  # Will be resolved later
                    confidence=0.9 if re.match(r'^[A-Z]{2,3}[-.]?\d{4}[-.]?\d+$', doc_number) else 0.7
                ))
    
    return matches


def find_customer_by_email(email_address: str) -> Optional[Tuple[int, str, float]]:
    """
    Find customer in HUGWAWI by email address.
    
    Returns:
        Tuple of (customer_id, customer_name, confidence) or None
    """
    if not email_address:
        return None
    
    email_address = email_address.lower().strip()
    domain = email_address.split('@')[1] if '@' in email_address else None
    
    try:
        conn = get_erp_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # First try exact match on contact email
        cursor.execute("""
            SELECT c.id, c.name, ct.email
            FROM customer c
            LEFT JOIN contact ct ON ct.customer = c.id
            WHERE LOWER(ct.email) = %s OR LOWER(c.email) = %s
            LIMIT 1
        """, (email_address, email_address))
        
        row = cursor.fetchone()
        if row:
            cursor.close()
            conn.close()
            return (row['id'], row['name'], 0.95)
        
        # Try domain match (lower confidence)
        if domain:
            cursor.execute("""
                SELECT c.id, c.name
                FROM customer c
                WHERE LOWER(c.email) LIKE %s
                   OR c.id IN (
                       SELECT DISTINCT customer FROM contact 
                       WHERE LOWER(email) LIKE %s
                   )
                LIMIT 5
            """, (f'%@{domain}', f'%@{domain}'))
            
            rows = cursor.fetchall()
            if len(rows) == 1:
                cursor.close()
                conn.close()
                return (rows[0]['id'], rows[0]['name'], 0.7)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error finding customer by email: {e}")
    
    return None


def find_supplier_by_email(email_address: str) -> Optional[Tuple[int, str, float]]:
    """
    Find supplier in HUGWAWI by email address.
    
    Returns:
        Tuple of (supplier_id, supplier_name, confidence) or None
    """
    if not email_address:
        return None
    
    email_address = email_address.lower().strip()
    domain = email_address.split('@')[1] if '@' in email_address else None
    
    try:
        conn = get_erp_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Try exact match
        cursor.execute("""
            SELECT s.id, s.name
            FROM supplier s
            WHERE LOWER(s.email) = %s
            LIMIT 1
        """, (email_address,))
        
        row = cursor.fetchone()
        if row:
            cursor.close()
            conn.close()
            return (row['id'], row['name'], 0.95)
        
        # Try domain match
        if domain:
            cursor.execute("""
                SELECT s.id, s.name
                FROM supplier s
                WHERE LOWER(s.email) LIKE %s
                LIMIT 5
            """, (f'%@{domain}',))
            
            rows = cursor.fetchall()
            if len(rows) == 1:
                cursor.close()
                conn.close()
                return (rows[0]['id'], rows[0]['name'], 0.7)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error finding supplier by email: {e}")
    
    return None


def resolve_document_id(doc_type: str, doc_number: str) -> Optional[int]:
    """
    Resolve document number to ERP ID.
    
    Args:
        doc_type: Type of document ('offer', 'order', etc.)
        doc_number: Document number string
    
    Returns:
        ERP document ID or None
    """
    try:
        conn = get_erp_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Map document type to HUGWAWI table
        table_map = {
            'offer': ('ordertable', 'name'),  # Angebote sind auch in ordertable
            'order': ('ordertable', 'name'),
            'purchase_order': ('ordertable', 'name'),
            'delivery_note': ('packingnote', 'number'),
            'invoice': ('invoice', 'number'),
        }
        
        if doc_type not in table_map:
            cursor.close()
            conn.close()
            return None
        
        table, column = table_map[doc_type]
        
        # Search for document
        # Try exact match first, then pattern match
        cursor.execute(f"""
            SELECT id FROM {table}
            WHERE {column} = %s OR {column} LIKE %s
            LIMIT 1
        """, (doc_number, f'%{doc_number}%'))
        
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
            return row['id']
        
    except Exception as e:
        print(f"Error resolving document ID: {e}")
    
    return None


def auto_assign_communication(db: Session, communication_id: int) -> List[AssignmentSuggestion]:
    """
    Automatically assign a communication to customer/supplier/documents.
    
    Args:
        db: Database session
        communication_id: ID of communication to assign
    
    Returns:
        List of assignment suggestions with confidence scores
    """
    comm = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.id == communication_id
    ).first()
    
    if not comm:
        return []
    
    suggestions = []
    
    # 1. Try to match customer/supplier by email
    email_to_check = None
    if comm.entry_type == "email_in":
        email_to_check = comm.sender_email
    elif comm.entry_type == "email_out" and comm.recipient_emails:
        email_to_check = comm.recipient_emails[0]
    
    if email_to_check:
        # Try customer first
        customer_match = find_customer_by_email(email_to_check)
        if customer_match:
            customer_id, customer_name, confidence = customer_match
            suggestions.append(AssignmentSuggestion(
                target_type='customer',
                erp_id=customer_id,
                name=customer_name,
                confidence=confidence,
                reason=f"E-Mail-Adresse {email_to_check} passt zu Kunde"
            ))
        
        # Try supplier
        supplier_match = find_supplier_by_email(email_to_check)
        if supplier_match:
            supplier_id, supplier_name, confidence = supplier_match
            suggestions.append(AssignmentSuggestion(
                target_type='supplier',
                erp_id=supplier_id,
                name=supplier_name,
                confidence=confidence,
                reason=f"E-Mail-Adresse {email_to_check} passt zu Lieferant"
            ))
    
    # 2. Extract document references from subject and body
    search_text = f"{comm.subject or ''} {comm.body_text or ''}"
    doc_matches = extract_document_references(search_text)
    
    for doc in doc_matches:
        # Try to resolve to ERP ID
        erp_id = resolve_document_id(doc.document_type, doc.document_number)
        
        suggestions.append(AssignmentSuggestion(
            target_type='document',
            erp_id=erp_id or 0,
            name=f"{doc.document_type.upper()}: {doc.document_number}",
            confidence=doc.confidence if erp_id else doc.confidence * 0.5,
            reason=f"Belegnummer '{doc.document_number}' im {'Betreff' if doc.document_number in (comm.subject or '') else 'Text'} gefunden"
        ))
    
    # 3. Apply custom assignment rules
    custom_rules = db.query(CRMAssignmentRule).filter(
        CRMAssignmentRule.is_active == True
    ).order_by(CRMAssignmentRule.priority).all()
    
    for rule in custom_rules:
        if rule.rule_type == 'email_domain':
            # Check if email domain matches
            if email_to_check and rule.pattern.lower() in email_to_check.lower():
                suggestions.append(AssignmentSuggestion(
                    target_type=rule.target_type,
                    erp_id=rule.erp_target_id or 0,
                    name=f"Regel: {rule.pattern}",
                    confidence=0.85,
                    reason=f"Zuordnungsregel für Domain '{rule.pattern}'"
                ))
        
        elif rule.rule_type == 'document_pattern':
            # Check if document pattern matches
            if re.search(rule.pattern, search_text, re.IGNORECASE):
                suggestions.append(AssignmentSuggestion(
                    target_type='document',
                    erp_id=rule.erp_target_id or 0,
                    name=f"Regel: {rule.pattern}",
                    confidence=0.8,
                    reason=f"Zuordnungsregel für Muster '{rule.pattern}'"
                ))
    
    # Sort by confidence
    suggestions.sort(key=lambda x: x.confidence, reverse=True)
    
    return suggestions


def apply_assignment(
    db: Session,
    communication_id: int,
    erp_customer_id: Optional[int] = None,
    erp_supplier_id: Optional[int] = None,
    document_links: Optional[List[Dict[str, Any]]] = None,
    user_name: Optional[str] = None
) -> bool:
    """
    Apply assignment to a communication.
    
    Args:
        db: Database session
        communication_id: ID of communication
        erp_customer_id: Customer ID to assign
        erp_supplier_id: Supplier ID to assign
        document_links: List of document links [{'link_type': str, 'erp_document_id': int}]
        user_name: Name of user making assignment
    
    Returns:
        True if successful
    """
    comm = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.id == communication_id
    ).first()
    
    if not comm:
        return False
    
    old_values = {
        'erp_customer_id': comm.erp_customer_id,
        'erp_supplier_id': comm.erp_supplier_id,
    }
    new_values = {}
    
    # Update customer/supplier
    if erp_customer_id is not None:
        comm.erp_customer_id = erp_customer_id
        new_values['erp_customer_id'] = erp_customer_id
    
    if erp_supplier_id is not None:
        comm.erp_supplier_id = erp_supplier_id
        new_values['erp_supplier_id'] = erp_supplier_id
    
    comm.is_auto_assigned = False  # Manual assignment
    comm.updated_at = datetime.utcnow()
    
    # Add document links
    if document_links:
        for link_data in document_links:
            # Check if link already exists
            existing = db.query(CRMCommunicationLink).filter(
                CRMCommunicationLink.communication_id == communication_id,
                CRMCommunicationLink.link_type == link_data['link_type'],
                CRMCommunicationLink.erp_document_id == link_data['erp_document_id']
            ).first()
            
            if not existing:
                link = CRMCommunicationLink(
                    communication_id=communication_id,
                    link_type=link_data['link_type'],
                    erp_document_id=link_data['erp_document_id'],
                    erp_document_number=link_data.get('erp_document_number'),
                    is_auto_assigned=False,
                    assigned_at=datetime.utcnow(),
                )
                db.add(link)
    
    # Log audit
    if new_values:
        audit = CRMAuditLog(
            entity_type='communication',
            entity_id=communication_id,
            action='assign',
            old_values=old_values,
            new_values=new_values,
            user_name=user_name,
            created_at=datetime.utcnow(),
        )
        db.add(audit)
    
    db.commit()
    
    return True


def auto_assign_batch(db: Session, limit: int = 100) -> Dict[str, int]:
    """
    Auto-assign unassigned communications in batch.
    
    Args:
        db: Database session
        limit: Maximum number of communications to process
    
    Returns:
        Dict with counts of assigned communications
    """
    # Find unassigned communications
    unassigned = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.erp_customer_id.is_(None),
        CRMCommunicationEntry.erp_supplier_id.is_(None),
        CRMCommunicationEntry.is_auto_assigned == False,
    ).limit(limit).all()
    
    results = {
        'processed': 0,
        'assigned_customer': 0,
        'assigned_supplier': 0,
        'assigned_document': 0,
        'no_match': 0,
    }
    
    for comm in unassigned:
        results['processed'] += 1
        
        suggestions = auto_assign_communication(db, comm.id)
        
        if not suggestions:
            results['no_match'] += 1
            continue
        
        # Apply best suggestion if confidence is high enough
        best = suggestions[0]
        
        if best.confidence >= 0.8:
            if best.target_type == 'customer':
                comm.erp_customer_id = best.erp_id
                comm.assignment_confidence = best.confidence
                comm.is_auto_assigned = True
                results['assigned_customer'] += 1
            
            elif best.target_type == 'supplier':
                comm.erp_supplier_id = best.erp_id
                comm.assignment_confidence = best.confidence
                comm.is_auto_assigned = True
                results['assigned_supplier'] += 1
            
            elif best.target_type == 'document' and best.erp_id:
                link = CRMCommunicationLink(
                    communication_id=comm.id,
                    link_type=best.name.split(':')[0].lower() if ':' in best.name else 'order',
                    erp_document_id=best.erp_id,
                    is_auto_assigned=True,
                    assigned_at=datetime.utcnow(),
                )
                db.add(link)
                results['assigned_document'] += 1
        else:
            results['no_match'] += 1
    
    db.commit()
    
    return results
