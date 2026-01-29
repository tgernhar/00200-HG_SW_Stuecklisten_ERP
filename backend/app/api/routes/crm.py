"""
CRM (Customer Relationship Management) API Routes

Main endpoints for:
- Communications (CRUD, timeline)
- Tasks/Reminders
- Leads/Chances
- Tags
- Search
- Dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models.crm import (
    CRMMailbox, CRMCommunicationEntry, CRMCommunicationAttachment,
    CRMCommunicationLink, CRMTag, CRMCustomerTag, CRMLead, CRMLeadTag,
    CRMTask, CRMEmailTemplate, CRMUserSignature, CRMAuditLog
)
from app.models.pps_todo import PPSResourceCache
from app.schemas.crm import (
    CommunicationType, LeadStatus, TaskType, TaskStatus, TagType, DocumentLinkType,
    Mailbox, MailboxCreate, MailboxUpdate, MailboxListResponse,
    Tag, TagCreate, TagUpdate, TagListResponse,
    Attachment,
    CommunicationLink, CommunicationLinkBase, CommunicationLinkCreate,
    CommunicationEntry, CommunicationEntryCreate, CommunicationEntryUpdate,
    CommunicationEntryWithDetails, CommunicationListResponse,
    Lead, LeadCreate, LeadUpdate, LeadWithDetails, LeadListResponse, LeadConvertRequest,
    Task, TaskCreate, TaskUpdate, TaskWithDetails, TaskListResponse, MyDayResponse,
    EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateListResponse,
    UserSignature, UserSignatureCreate, UserSignatureUpdate,
    TimelineEntry, TimelineResponse,
    SearchRequest, SearchResult, SearchResponse,
    DashboardStats, RecentActivity, DashboardResponse,
    CustomerInfo, SupplierInfo, CustomerSearchResponse, SupplierSearchResponse,
    EmailSendRequest, EmailSendResponse, TemplateRenderRequest, TemplateRenderResponse,
)

router = APIRouter(prefix="/crm", tags=["CRM"])


# ============== Helper Functions ==============

def _log_audit(db: Session, entity_type: str, entity_id: int, action: str,
               old_values: dict = None, new_values: dict = None, user_name: str = None):
    """Create audit log entry"""
    log = CRMAuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_values=old_values,
        new_values=new_values,
        user_name=user_name,
        created_at=datetime.utcnow(),
    )
    db.add(log)


def _communication_to_response(comm: CRMCommunicationEntry) -> CommunicationEntry:
    """Convert SQLAlchemy model to Pydantic schema"""
    return CommunicationEntry(
        id=comm.id,
        entry_type=CommunicationType(comm.entry_type),
        subject=comm.subject,
        body_html=comm.body_html,
        body_text=comm.body_text,
        sender_email=comm.sender_email,
        sender_name=comm.sender_name,
        recipient_emails=comm.recipient_emails,
        cc_emails=comm.cc_emails,
        bcc_emails=comm.bcc_emails,
        message_id=comm.message_id,
        in_reply_to=comm.in_reply_to,
        thread_id=comm.thread_id,
        mailbox_id=comm.mailbox_id,
        is_internal=comm.is_internal,
        is_read=comm.is_read,
        erp_customer_id=comm.erp_customer_id,
        erp_supplier_id=comm.erp_supplier_id,
        erp_contact_id=comm.erp_contact_id,
        assignment_confidence=comm.assignment_confidence,
        is_auto_assigned=comm.is_auto_assigned,
        created_by_user_id=comm.created_by_user_id,
        communication_date=comm.communication_date,
        created_at=comm.created_at,
        updated_at=comm.updated_at,
        attachments=[Attachment.model_validate(a) for a in comm.attachments] if comm.attachments else [],
        links=[CommunicationLink.model_validate(l) for l in comm.links] if comm.links else [],
        attachment_count=len(comm.attachments) if comm.attachments else 0,
    )


def _task_to_response(task: CRMTask) -> Task:
    """Convert SQLAlchemy model to Pydantic schema"""
    return Task(
        id=task.id,
        title=task.title,
        description=task.description,
        task_type=TaskType(task.task_type),
        status=TaskStatus(task.status),
        priority=task.priority,
        due_date=task.due_date,
        due_time=task.due_time,
        assigned_user_id=task.assigned_user_id,
        assigned_employee_id=task.assigned_employee_id,
        created_by_user_id=task.created_by_user_id,
        erp_customer_id=task.erp_customer_id,
        erp_supplier_id=task.erp_supplier_id,
        lead_id=task.lead_id,
        communication_id=task.communication_id,
        link_type=task.link_type,
        erp_document_id=task.erp_document_id,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_overdue=task.is_overdue(),
        assigned_employee_name=task.assigned_employee.name if task.assigned_employee else None,
    )


def _lead_to_response(lead: CRMLead) -> Lead:
    """Convert SQLAlchemy model to Pydantic schema"""
    return Lead(
        id=lead.id,
        title=lead.title,
        description=lead.description,
        erp_customer_id=lead.erp_customer_id,
        customer_name=lead.customer_name,
        contact_email=lead.contact_email,
        contact_phone=lead.contact_phone,
        status=LeadStatus(lead.status),
        lost_reason=lead.lost_reason,
        expected_value=lead.expected_value,
        expected_close_date=lead.expected_close_date,
        assigned_employee_id=lead.assigned_employee_id,
        erp_offer_id=lead.erp_offer_id,
        source=lead.source,
        priority=lead.priority,
        created_by_user_id=lead.created_by_user_id,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        tags=[Tag.model_validate(lt.tag) for lt in lead.tags] if lead.tags else [],
        assigned_employee_name=lead.assigned_employee.name if lead.assigned_employee else None,
    )


# ============== Communications ==============

@router.get("/communications", response_model=CommunicationListResponse)
async def get_communications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    entry_type: Optional[str] = None,
    erp_customer_id: Optional[int] = None,
    erp_supplier_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    is_read: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get communications with filters"""
    query = db.query(CRMCommunicationEntry).options(
        joinedload(CRMCommunicationEntry.attachments),
        joinedload(CRMCommunicationEntry.links),
    )
    
    if entry_type:
        types = [t.strip() for t in entry_type.split(",")]
        query = query.filter(CRMCommunicationEntry.entry_type.in_(types))
    
    if erp_customer_id:
        query = query.filter(CRMCommunicationEntry.erp_customer_id == erp_customer_id)
    
    if erp_supplier_id:
        query = query.filter(CRMCommunicationEntry.erp_supplier_id == erp_supplier_id)
    
    if date_from:
        query = query.filter(CRMCommunicationEntry.communication_date >= date_from)
    
    if date_to:
        query = query.filter(CRMCommunicationEntry.communication_date <= date_to)
    
    if is_read is not None:
        query = query.filter(CRMCommunicationEntry.is_read == is_read)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                CRMCommunicationEntry.subject.ilike(search_pattern),
                CRMCommunicationEntry.body_text.ilike(search_pattern),
                CRMCommunicationEntry.sender_email.ilike(search_pattern),
            )
        )
    
    total = query.count()
    
    communications = query.order_by(desc(CRMCommunicationEntry.communication_date)).offset(skip).limit(limit).all()
    
    items = [_communication_to_response(c) for c in communications]
    
    return CommunicationListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/communications/{comm_id}", response_model=CommunicationEntry)
async def get_communication(comm_id: int, db: Session = Depends(get_db)):
    """Get single communication with details"""
    comm = db.query(CRMCommunicationEntry).options(
        joinedload(CRMCommunicationEntry.attachments),
        joinedload(CRMCommunicationEntry.links),
    ).filter(CRMCommunicationEntry.id == comm_id).first()
    
    if not comm:
        raise HTTPException(status_code=404, detail="Kommunikation nicht gefunden")
    
    return _communication_to_response(comm)


@router.post("/communications", response_model=CommunicationEntry)
async def create_communication(payload: CommunicationEntryCreate, db: Session = Depends(get_db)):
    """Create new communication entry (phone call, meeting, note)"""
    comm = CRMCommunicationEntry(
        entry_type=payload.entry_type.value,
        subject=payload.subject,
        body_html=payload.body_html,
        body_text=payload.body_text,
        sender_email=payload.sender_email,
        sender_name=payload.sender_name,
        recipient_emails=payload.recipient_emails,
        cc_emails=payload.cc_emails,
        is_internal=payload.is_internal,
        erp_customer_id=payload.erp_customer_id,
        erp_supplier_id=payload.erp_supplier_id,
        erp_contact_id=payload.erp_contact_id,
        communication_date=payload.communication_date,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(comm)
    db.flush()  # Get ID
    
    # Add document links
    if payload.document_links:
        for link_data in payload.document_links:
            link = CRMCommunicationLink(
                communication_id=comm.id,
                link_type=link_data.link_type.value,
                erp_document_id=link_data.erp_document_id,
                erp_document_number=link_data.erp_document_number,
                is_auto_assigned=False,
            )
            db.add(link)
    
    _log_audit(db, "communication", comm.id, "create", new_values={"type": comm.entry_type, "subject": comm.subject})
    
    db.commit()
    db.refresh(comm)
    
    return _communication_to_response(comm)


@router.patch("/communications/{comm_id}", response_model=CommunicationEntry)
async def update_communication(comm_id: int, payload: CommunicationEntryUpdate, db: Session = Depends(get_db)):
    """Update communication entry"""
    comm = db.query(CRMCommunicationEntry).filter(CRMCommunicationEntry.id == comm_id).first()
    
    if not comm:
        raise HTTPException(status_code=404, detail="Kommunikation nicht gefunden")
    
    old_values = {}
    new_values = {}
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        old_val = getattr(comm, field, None)
        if old_val != value:
            old_values[field] = str(old_val) if old_val else None
            new_values[field] = str(value) if value else None
        setattr(comm, field, value)
    
    comm.updated_at = datetime.utcnow()
    
    if old_values:
        _log_audit(db, "communication", comm.id, "update", old_values=old_values, new_values=new_values)
    
    db.commit()
    db.refresh(comm)
    
    return _communication_to_response(comm)


@router.delete("/communications/{comm_id}")
async def delete_communication(comm_id: int, db: Session = Depends(get_db)):
    """Delete communication entry"""
    comm = db.query(CRMCommunicationEntry).filter(CRMCommunicationEntry.id == comm_id).first()
    
    if not comm:
        raise HTTPException(status_code=404, detail="Kommunikation nicht gefunden")
    
    _log_audit(db, "communication", comm_id, "delete", old_values={"subject": comm.subject})
    
    db.delete(comm)
    db.commit()
    
    return {"success": True, "deleted_id": comm_id}


@router.post("/communications/{comm_id}/links", response_model=CommunicationLink)
async def add_document_link(comm_id: int, payload: CommunicationLinkBase, db: Session = Depends(get_db)):
    """Add document link to communication"""
    comm = db.query(CRMCommunicationEntry).filter(CRMCommunicationEntry.id == comm_id).first()
    
    if not comm:
        raise HTTPException(status_code=404, detail="Kommunikation nicht gefunden")
    
    link = CRMCommunicationLink(
        communication_id=comm_id,
        link_type=payload.link_type.value,
        erp_document_id=payload.erp_document_id,
        erp_document_number=payload.erp_document_number,
        # Extended references
        erp_order_article_id=payload.erp_order_article_id,
        erp_bom_item_id=payload.erp_bom_item_id,
        erp_operation_id=payload.erp_operation_id,
        local_article_id=payload.local_article_id,
        local_pps_todo_id=payload.local_pps_todo_id,
        is_auto_assigned=False,
    )
    
    db.add(link)
    db.commit()
    db.refresh(link)
    
    return CommunicationLink.model_validate(link)


@router.delete("/communications/{comm_id}/links/{link_id}")
async def remove_document_link(comm_id: int, link_id: int, db: Session = Depends(get_db)):
    """Remove document link from communication"""
    link = db.query(CRMCommunicationLink).filter(
        CRMCommunicationLink.id == link_id,
        CRMCommunicationLink.communication_id == comm_id
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Verknüpfung nicht gefunden")
    
    db.delete(link)
    db.commit()
    
    return {"success": True}


# ============== Timeline ==============

@router.get("/timeline/customer/{erp_customer_id}", response_model=TimelineResponse)
async def get_customer_timeline(
    erp_customer_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get complete timeline for a customer"""
    # Get communications
    communications = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.erp_customer_id == erp_customer_id
    ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Get tasks
    tasks = db.query(CRMTask).filter(
        CRMTask.erp_customer_id == erp_customer_id
    ).order_by(desc(CRMTask.created_at)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    for task in tasks:
        entries.append(TimelineEntry(
            id=task.id,
            entry_type="task",
            date=task.created_at,
            subject=task.title,
            body_preview=task.description[:200] if task.description else None,
            status=task.status,
            is_overdue=task.is_overdue(),
        ))
    
    # Sort by date descending
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    # Count by type
    email_count = sum(1 for e in entries if e.entry_type in ("email_in", "email_out"))
    call_count = sum(1 for e in entries if e.entry_type == "phone")
    meeting_count = sum(1 for e in entries if e.entry_type == "meeting")
    note_count = sum(1 for e in entries if e.entry_type == "note")
    task_count = sum(1 for e in entries if e.entry_type == "task")
    
    return TimelineResponse(
        entity_type="customer",
        entity_id=erp_customer_id,
        entries=entries,
        total=len(entries),
        email_count=email_count,
        call_count=call_count,
        meeting_count=meeting_count,
        note_count=note_count,
        task_count=task_count,
    )


@router.get("/timeline/document/{link_type}/{erp_document_id}", response_model=TimelineResponse)
async def get_document_timeline(
    link_type: str,
    erp_document_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for an ERP document (order, offer, etc.)"""
    # Get communications linked to this document
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.link_type == link_type,
        CRMCommunicationLink.erp_document_id == erp_document_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Get tasks linked to this document
    tasks = db.query(CRMTask).filter(
        CRMTask.link_type == link_type,
        CRMTask.erp_document_id == erp_document_id
    ).order_by(desc(CRMTask.created_at)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    for task in tasks:
        entries.append(TimelineEntry(
            id=task.id,
            entry_type="task",
            date=task.created_at,
            subject=task.title,
            body_preview=task.description[:200] if task.description else None,
            status=task.status,
            is_overdue=task.is_overdue(),
        ))
    
    # Sort by date descending
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type=link_type,
        entity_id=erp_document_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


@router.get("/timeline/order-article/{order_article_id}", response_model=TimelineResponse)
async def get_order_article_timeline(
    order_article_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for an order article (Auftragsartikel)"""
    # Get communications linked to this order article
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.erp_order_article_id == order_article_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type="order_article",
        entity_id=order_article_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


@router.get("/timeline/bom-item/{bom_item_id}", response_model=TimelineResponse)
async def get_bom_item_timeline(
    bom_item_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for a BOM item (Stücklistenartikel)"""
    # Get communications linked to this BOM item
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.erp_bom_item_id == bom_item_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type="bom_item",
        entity_id=bom_item_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


@router.get("/timeline/operation/{operation_id}", response_model=TimelineResponse)
async def get_operation_timeline(
    operation_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for an operation (Arbeitsgang)"""
    # Get communications linked to this operation
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.erp_operation_id == operation_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type="operation",
        entity_id=operation_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


@router.get("/timeline/local-article/{article_id}", response_model=TimelineResponse)
async def get_local_article_timeline(
    article_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for a local article (Stücklistenartikel aus lokaler DB)"""
    # Get communications linked to this local article
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.local_article_id == article_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type="local_article",
        entity_id=article_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


@router.get("/timeline/pps-todo/{todo_id}", response_model=TimelineResponse)
async def get_pps_todo_timeline(
    todo_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get timeline for a PPS Todo"""
    # Get communications linked to this PPS todo
    comm_ids = db.query(CRMCommunicationLink.communication_id).filter(
        CRMCommunicationLink.local_pps_todo_id == todo_id
    ).all()
    comm_ids = [c[0] for c in comm_ids]
    
    communications = []
    if comm_ids:
        communications = db.query(CRMCommunicationEntry).options(
            joinedload(CRMCommunicationEntry.attachments)
        ).filter(
            CRMCommunicationEntry.id.in_(comm_ids)
        ).order_by(desc(CRMCommunicationEntry.communication_date)).limit(limit).all()
    
    # Build timeline entries
    entries = []
    for comm in communications:
        entries.append(TimelineEntry(
            id=comm.id,
            entry_type=comm.entry_type,
            date=comm.communication_date,
            subject=comm.subject,
            body_preview=(comm.body_text or "")[:200] if comm.body_text else None,
            sender=comm.sender_name or comm.sender_email,
            is_internal=comm.is_internal,
            has_attachments=len(comm.attachments) > 0 if comm.attachments else False,
            attachment_count=len(comm.attachments) if comm.attachments else 0,
        ))
    
    entries.sort(key=lambda x: x.date, reverse=True)
    entries = entries[:limit]
    
    return TimelineResponse(
        entity_type="pps_todo",
        entity_id=todo_id,
        entries=entries,
        total=len(entries),
        email_count=sum(1 for e in entries if e.entry_type in ("email_in", "email_out")),
        call_count=sum(1 for e in entries if e.entry_type == "phone"),
        meeting_count=sum(1 for e in entries if e.entry_type == "meeting"),
        note_count=sum(1 for e in entries if e.entry_type == "note"),
        task_count=sum(1 for e in entries if e.entry_type == "task"),
    )


# ============== Tasks ==============

@router.get("/tasks", response_model=TaskListResponse)
async def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    assigned_employee_id: Optional[int] = None,
    erp_customer_id: Optional[int] = None,
    due_from: Optional[date] = None,
    due_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Get tasks with filters"""
    query = db.query(CRMTask).options(joinedload(CRMTask.assigned_employee))
    
    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(CRMTask.status.in_(statuses))
    
    if task_type:
        types = [t.strip() for t in task_type.split(",")]
        query = query.filter(CRMTask.task_type.in_(types))
    
    if assigned_employee_id:
        query = query.filter(CRMTask.assigned_employee_id == assigned_employee_id)
    
    if erp_customer_id:
        query = query.filter(CRMTask.erp_customer_id == erp_customer_id)
    
    if due_from:
        query = query.filter(CRMTask.due_date >= due_from)
    
    if due_to:
        query = query.filter(CRMTask.due_date <= due_to)
    
    total = query.count()
    
    # Count overdue and today
    today = date.today()
    overdue_count = query.filter(
        CRMTask.status.in_(["open", "in_progress"]),
        CRMTask.due_date < today
    ).count()
    today_count = query.filter(CRMTask.due_date == today).count()
    
    tasks = query.order_by(
        CRMTask.due_date.asc().nullslast(),
        CRMTask.priority.asc()
    ).offset(skip).limit(limit).all()
    
    items = [_task_to_response(t) for t in tasks]
    
    return TaskListResponse(
        items=items,
        total=total,
        overdue_count=overdue_count,
        today_count=today_count
    )


@router.get("/tasks/my-day", response_model=MyDayResponse)
async def get_my_day(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get 'My Day' view with today's tasks and overdue"""
    today = date.today()
    
    query = db.query(CRMTask).options(joinedload(CRMTask.assigned_employee))
    
    if employee_id:
        query = query.filter(CRMTask.assigned_employee_id == employee_id)
    
    # Today's tasks
    today_tasks = query.filter(
        CRMTask.due_date == today,
        CRMTask.status.in_(["open", "in_progress"])
    ).order_by(CRMTask.priority.asc()).all()
    
    # Overdue tasks
    overdue_tasks = query.filter(
        CRMTask.due_date < today,
        CRMTask.status.in_(["open", "in_progress"])
    ).order_by(CRMTask.due_date.asc()).all()
    
    # Upcoming (next 7 days)
    upcoming_tasks = query.filter(
        CRMTask.due_date > today,
        CRMTask.due_date <= today + timedelta(days=7),
        CRMTask.status.in_(["open", "in_progress"])
    ).order_by(CRMTask.due_date.asc()).limit(10).all()
    
    # Total open
    total_open = query.filter(CRMTask.status.in_(["open", "in_progress"])).count()
    
    return MyDayResponse(
        today_tasks=[_task_to_response(t) for t in today_tasks],
        overdue_tasks=[_task_to_response(t) for t in overdue_tasks],
        upcoming_tasks=[_task_to_response(t) for t in upcoming_tasks],
        total_open=total_open,
    )


@router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get single task"""
    task = db.query(CRMTask).options(
        joinedload(CRMTask.assigned_employee)
    ).filter(CRMTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    return _task_to_response(task)


@router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    """Create new task"""
    task = CRMTask(
        title=payload.title,
        description=payload.description,
        task_type=payload.task_type.value,
        status=payload.status.value,
        priority=payload.priority,
        due_date=payload.due_date,
        due_time=payload.due_time,
        assigned_employee_id=payload.assigned_employee_id,
        erp_customer_id=payload.erp_customer_id,
        erp_supplier_id=payload.erp_supplier_id,
        lead_id=payload.lead_id,
        communication_id=payload.communication_id,
        link_type=payload.link_type.value if payload.link_type else None,
        erp_document_id=payload.erp_document_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    _log_audit(db, "task", task.id, "create", new_values={"title": task.title})
    db.commit()
    
    return _task_to_response(task)


@router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    """Update task"""
    task = db.query(CRMTask).options(
        joinedload(CRMTask.assigned_employee)
    ).filter(CRMTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    old_values = {}
    new_values = {}
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value if hasattr(value, "value") else value
        if field == "task_type" and value:
            value = value.value if hasattr(value, "value") else value
        if field == "link_type" and value:
            value = value.value if hasattr(value, "value") else value
            
        old_val = getattr(task, field, None)
        if old_val != value:
            old_values[field] = str(old_val) if old_val else None
            new_values[field] = str(value) if value else None
        setattr(task, field, value)
    
    # Set completed_at if status changed to completed
    if payload.status == TaskStatus.COMPLETED and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    
    task.updated_at = datetime.utcnow()
    
    if old_values:
        _log_audit(db, "task", task.id, "update", old_values=old_values, new_values=new_values)
    
    db.commit()
    db.refresh(task)
    
    return _task_to_response(task)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete task"""
    task = db.query(CRMTask).filter(CRMTask.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    _log_audit(db, "task", task_id, "delete", old_values={"title": task.title})
    
    db.delete(task)
    db.commit()
    
    return {"success": True, "deleted_id": task_id}


# ============== Leads ==============

@router.get("/leads", response_model=LeadListResponse)
async def get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    assigned_employee_id: Optional[int] = None,
    erp_customer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get leads with filters"""
    query = db.query(CRMLead).options(
        joinedload(CRMLead.tags).joinedload(CRMLeadTag.tag),
        joinedload(CRMLead.assigned_employee),
    )
    
    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(CRMLead.status.in_(statuses))
    
    if assigned_employee_id:
        query = query.filter(CRMLead.assigned_employee_id == assigned_employee_id)
    
    if erp_customer_id:
        query = query.filter(CRMLead.erp_customer_id == erp_customer_id)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                CRMLead.title.ilike(search_pattern),
                CRMLead.customer_name.ilike(search_pattern),
                CRMLead.contact_email.ilike(search_pattern),
            )
        )
    
    total = query.count()
    
    # Count by status
    by_status = {}
    for s in ["new", "qualified", "proposal", "negotiation", "won", "lost"]:
        by_status[s] = db.query(CRMLead).filter(CRMLead.status == s).count()
    
    leads = query.order_by(
        CRMLead.priority.asc(),
        desc(CRMLead.updated_at)
    ).offset(skip).limit(limit).all()
    
    items = [_lead_to_response(l) for l in leads]
    
    return LeadListResponse(items=items, total=total, by_status=by_status)


@router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: int, db: Session = Depends(get_db)):
    """Get single lead"""
    lead = db.query(CRMLead).options(
        joinedload(CRMLead.tags).joinedload(CRMLeadTag.tag),
        joinedload(CRMLead.assigned_employee),
    ).filter(CRMLead.id == lead_id).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")
    
    return _lead_to_response(lead)


@router.post("/leads", response_model=Lead)
async def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    """Create new lead"""
    lead = CRMLead(
        title=payload.title,
        description=payload.description,
        erp_customer_id=payload.erp_customer_id,
        customer_name=payload.customer_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        status=payload.status.value,
        expected_value=payload.expected_value,
        expected_close_date=payload.expected_close_date,
        assigned_employee_id=payload.assigned_employee_id,
        source=payload.source,
        priority=payload.priority,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(lead)
    db.flush()
    
    # Add tags
    if payload.tag_ids:
        for tag_id in payload.tag_ids:
            lead_tag = CRMLeadTag(lead_id=lead.id, tag_id=tag_id)
            db.add(lead_tag)
    
    _log_audit(db, "lead", lead.id, "create", new_values={"title": lead.title, "status": lead.status})
    
    db.commit()
    db.refresh(lead)
    
    return _lead_to_response(lead)


@router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)):
    """Update lead"""
    lead = db.query(CRMLead).options(
        joinedload(CRMLead.tags).joinedload(CRMLeadTag.tag),
        joinedload(CRMLead.assigned_employee),
    ).filter(CRMLead.id == lead_id).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")
    
    old_values = {}
    new_values = {}
    
    update_data = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value if hasattr(value, "value") else value
            
        old_val = getattr(lead, field, None)
        if old_val != value:
            old_values[field] = str(old_val) if old_val else None
            new_values[field] = str(value) if value else None
        setattr(lead, field, value)
    
    # Update tags if provided
    if payload.tag_ids is not None:
        # Remove existing tags
        db.query(CRMLeadTag).filter(CRMLeadTag.lead_id == lead_id).delete()
        # Add new tags
        for tag_id in payload.tag_ids:
            lead_tag = CRMLeadTag(lead_id=lead_id, tag_id=tag_id)
            db.add(lead_tag)
    
    lead.updated_at = datetime.utcnow()
    
    if old_values:
        _log_audit(db, "lead", lead.id, "update", old_values=old_values, new_values=new_values)
    
    db.commit()
    db.refresh(lead)
    
    return _lead_to_response(lead)


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    """Delete lead"""
    lead = db.query(CRMLead).filter(CRMLead.id == lead_id).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")
    
    _log_audit(db, "lead", lead_id, "delete", old_values={"title": lead.title})
    
    db.delete(lead)
    db.commit()
    
    return {"success": True, "deleted_id": lead_id}


# ============== Tags ==============

@router.get("/tags", response_model=TagListResponse)
async def get_tags(
    tag_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all tags"""
    query = db.query(CRMTag)
    
    if tag_type:
        query = query.filter(CRMTag.tag_type == tag_type)
    
    tags = query.order_by(CRMTag.name).all()
    
    return TagListResponse(items=[Tag.model_validate(t) for t in tags], total=len(tags))


@router.post("/tags", response_model=Tag)
async def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    """Create new tag"""
    # Check if tag name exists
    existing = db.query(CRMTag).filter(CRMTag.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag mit diesem Namen existiert bereits")
    
    tag = CRMTag(
        name=payload.name,
        color=payload.color,
        tag_type=payload.tag_type.value,
        created_at=datetime.utcnow(),
    )
    
    db.add(tag)
    db.commit()
    db.refresh(tag)
    
    return Tag.model_validate(tag)


@router.patch("/tags/{tag_id}", response_model=Tag)
async def update_tag(tag_id: int, payload: TagUpdate, db: Session = Depends(get_db)):
    """Update tag"""
    tag = db.query(CRMTag).filter(CRMTag.id == tag_id).first()
    
    if not tag:
        raise HTTPException(status_code=404, detail="Tag nicht gefunden")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "tag_type" and value:
            value = value.value if hasattr(value, "value") else value
        setattr(tag, field, value)
    
    db.commit()
    db.refresh(tag)
    
    return Tag.model_validate(tag)


@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Delete tag"""
    tag = db.query(CRMTag).filter(CRMTag.id == tag_id).first()
    
    if not tag:
        raise HTTPException(status_code=404, detail="Tag nicht gefunden")
    
    db.delete(tag)
    db.commit()
    
    return {"success": True, "deleted_id": tag_id}


# ============== Email Templates ==============

@router.get("/templates", response_model=EmailTemplateListResponse)
async def get_templates(
    template_type: Optional[str] = None,
    language: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get email templates"""
    query = db.query(CRMEmailTemplate).filter(CRMEmailTemplate.is_active == True)
    
    if template_type:
        query = query.filter(CRMEmailTemplate.template_type == template_type)
    
    if language:
        query = query.filter(CRMEmailTemplate.language == language)
    
    templates = query.order_by(CRMEmailTemplate.name).all()
    
    return EmailTemplateListResponse(
        items=[EmailTemplate.model_validate(t) for t in templates],
        total=len(templates)
    )


@router.post("/templates", response_model=EmailTemplate)
async def create_template(payload: EmailTemplateCreate, db: Session = Depends(get_db)):
    """Create email template"""
    template = CRMEmailTemplate(
        name=payload.name,
        language=payload.language,
        subject_template=payload.subject_template,
        body_template=payload.body_template,
        template_type=payload.template_type,
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return EmailTemplate.model_validate(template)


@router.patch("/templates/{template_id}", response_model=EmailTemplate)
async def update_template(template_id: int, payload: EmailTemplateUpdate, db: Session = Depends(get_db)):
    """Update email template"""
    template = db.query(CRMEmailTemplate).filter(CRMEmailTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    template.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(template)
    
    return EmailTemplate.model_validate(template)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete email template"""
    template = db.query(CRMEmailTemplate).filter(CRMEmailTemplate.id == template_id).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    
    db.delete(template)
    db.commit()
    
    return {"success": True, "deleted_id": template_id}


# ============== Mailboxes ==============

@router.get("/mailboxes", response_model=MailboxListResponse)
async def get_mailboxes(db: Session = Depends(get_db)):
    """Get configured mailboxes"""
    mailboxes = db.query(CRMMailbox).order_by(CRMMailbox.name).all()
    
    return MailboxListResponse(
        items=[Mailbox.model_validate(m) for m in mailboxes],
        total=len(mailboxes)
    )


@router.post("/mailboxes", response_model=Mailbox)
async def create_mailbox(payload: MailboxCreate, db: Session = Depends(get_db)):
    """Create mailbox configuration"""
    # Note: In production, passwords should be encrypted
    mailbox = CRMMailbox(
        name=payload.name,
        email_address=payload.email_address,
        imap_host=payload.imap_host,
        imap_port=payload.imap_port,
        imap_use_tls=payload.imap_use_tls,
        imap_username=payload.imap_username,
        imap_password_encrypted=payload.imap_password,  # TODO: Encrypt
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_use_tls=payload.smtp_use_tls,
        smtp_username=payload.smtp_username,
        smtp_password_encrypted=payload.smtp_password,  # TODO: Encrypt
        sync_folders=payload.sync_folders,
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(mailbox)
    db.commit()
    db.refresh(mailbox)
    
    return Mailbox.model_validate(mailbox)


# ============== Dashboard ==============

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get CRM dashboard data"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    # Communication stats
    total_communications = db.query(CRMCommunicationEntry).count()
    unread_emails = db.query(CRMCommunicationEntry).filter(
        CRMCommunicationEntry.entry_type.in_(["email_in"]),
        CRMCommunicationEntry.is_read == False
    ).count()
    communications_today = db.query(CRMCommunicationEntry).filter(
        func.date(CRMCommunicationEntry.communication_date) == today
    ).count()
    communications_this_week = db.query(CRMCommunicationEntry).filter(
        func.date(CRMCommunicationEntry.communication_date) >= week_start
    ).count()
    
    # Task stats
    task_query = db.query(CRMTask)
    if employee_id:
        task_query = task_query.filter(CRMTask.assigned_employee_id == employee_id)
    
    open_tasks = task_query.filter(CRMTask.status.in_(["open", "in_progress"])).count()
    overdue_tasks = task_query.filter(
        CRMTask.status.in_(["open", "in_progress"]),
        CRMTask.due_date < today
    ).count()
    tasks_due_today = task_query.filter(CRMTask.due_date == today).count()
    tasks_completed_this_week = task_query.filter(
        CRMTask.status == "completed",
        func.date(CRMTask.completed_at) >= week_start
    ).count()
    
    # Lead stats
    lead_query = db.query(CRMLead)
    if employee_id:
        lead_query = lead_query.filter(CRMLead.assigned_employee_id == employee_id)
    
    total_leads = lead_query.filter(CRMLead.status.notin_(["won", "lost"])).count()
    leads_by_status = {}
    for s in ["new", "qualified", "proposal", "negotiation"]:
        leads_by_status[s] = lead_query.filter(CRMLead.status == s).count()
    
    pipeline_value = db.query(func.sum(CRMLead.expected_value)).filter(
        CRMLead.status.notin_(["won", "lost"])
    ).scalar() or 0
    
    leads_won_this_month = lead_query.filter(
        CRMLead.status == "won",
        func.date(CRMLead.updated_at) >= month_start
    ).count()
    leads_lost_this_month = lead_query.filter(
        CRMLead.status == "lost",
        func.date(CRMLead.updated_at) >= month_start
    ).count()
    
    stats = DashboardStats(
        total_communications=total_communications,
        unread_emails=unread_emails,
        communications_today=communications_today,
        communications_this_week=communications_this_week,
        open_tasks=open_tasks,
        overdue_tasks=overdue_tasks,
        tasks_due_today=tasks_due_today,
        tasks_completed_this_week=tasks_completed_this_week,
        total_leads=total_leads,
        leads_by_status=leads_by_status,
        pipeline_value=pipeline_value,
        leads_won_this_month=leads_won_this_month,
        leads_lost_this_month=leads_lost_this_month,
    )
    
    # Recent activities
    recent_comms = db.query(CRMCommunicationEntry).order_by(
        desc(CRMCommunicationEntry.communication_date)
    ).limit(5).all()
    
    recent_activities = []
    for comm in recent_comms:
        recent_activities.append(RecentActivity(
            id=comm.id,
            activity_type="communication",
            title=comm.subject or f"{comm.entry_type} Eintrag",
            description=(comm.body_text or "")[:100] if comm.body_text else None,
            date=comm.communication_date,
        ))
    
    # My tasks (if employee_id)
    my_tasks = []
    if employee_id:
        tasks = db.query(CRMTask).options(
            joinedload(CRMTask.assigned_employee)
        ).filter(
            CRMTask.assigned_employee_id == employee_id,
            CRMTask.status.in_(["open", "in_progress"])
        ).order_by(CRMTask.due_date.asc().nullslast()).limit(5).all()
        my_tasks = [_task_to_response(t) for t in tasks]
    
    # My leads (if employee_id)
    my_leads = []
    if employee_id:
        leads = db.query(CRMLead).options(
            joinedload(CRMLead.tags).joinedload(CRMLeadTag.tag),
            joinedload(CRMLead.assigned_employee),
        ).filter(
            CRMLead.assigned_employee_id == employee_id,
            CRMLead.status.notin_(["won", "lost"])
        ).order_by(CRMLead.priority.asc()).limit(5).all()
        my_leads = [_lead_to_response(l) for l in leads]
    
    return DashboardResponse(
        stats=stats,
        recent_activities=recent_activities,
        my_tasks=my_tasks,
        my_leads=my_leads,
    )


# ============== Search ==============

@router.get("/search", response_model=SearchResponse)
async def search_communications(
    q: str = Query(..., min_length=2),
    entry_types: Optional[str] = None,
    erp_customer_id: Optional[int] = None,
    erp_supplier_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Search communications"""
    search_pattern = f"%{q}%"
    
    query = db.query(CRMCommunicationEntry).filter(
        or_(
            CRMCommunicationEntry.subject.ilike(search_pattern),
            CRMCommunicationEntry.body_text.ilike(search_pattern),
            CRMCommunicationEntry.sender_email.ilike(search_pattern),
            CRMCommunicationEntry.sender_name.ilike(search_pattern),
        )
    )
    
    if entry_types:
        types = [t.strip() for t in entry_types.split(",")]
        query = query.filter(CRMCommunicationEntry.entry_type.in_(types))
    
    if erp_customer_id:
        query = query.filter(CRMCommunicationEntry.erp_customer_id == erp_customer_id)
    
    if erp_supplier_id:
        query = query.filter(CRMCommunicationEntry.erp_supplier_id == erp_supplier_id)
    
    if date_from:
        query = query.filter(CRMCommunicationEntry.communication_date >= date_from)
    
    if date_to:
        query = query.filter(CRMCommunicationEntry.communication_date <= date_to)
    
    total = query.count()
    
    results = query.order_by(desc(CRMCommunicationEntry.communication_date)).offset(offset).limit(limit).all()
    
    items = []
    for r in results:
        # Create simple highlight
        highlight = None
        if r.body_text and q.lower() in r.body_text.lower():
            idx = r.body_text.lower().find(q.lower())
            start = max(0, idx - 50)
            end = min(len(r.body_text), idx + len(q) + 50)
            highlight = "..." + r.body_text[start:end] + "..."
        
        items.append(SearchResult(
            id=r.id,
            entry_type=r.entry_type,
            subject=r.subject,
            body_preview=(r.body_text or "")[:200] if r.body_text else None,
            sender=r.sender_name or r.sender_email,
            date=r.communication_date,
            relevance_score=1.0,  # Simple scoring
            highlight=highlight,
        ))
    
    return SearchResponse(items=items, total=total, query=q)


# ============== Customer/Supplier Search (HUGWAWI) ==============

@router.get("/customers/search", response_model=CustomerSearchResponse)
async def search_customers(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search customers in HUGWAWI"""
    from app.core.database import get_erp_db_connection
    
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        search_pattern = f"%{q}%"
        
        cursor.execute("""
            SELECT 
                c.id,
                c.customernumber as customer_number,
                c.name,
                c.email,
                c.phone,
                c.city
            FROM customer c
            WHERE c.name LIKE %s 
               OR c.customernumber LIKE %s 
               OR c.email LIKE %s
            ORDER BY c.name
            LIMIT %s
        """, (search_pattern, search_pattern, search_pattern, limit))
        
        rows = cursor.fetchall()
        cursor.close()
        erp_conn.close()
        
        items = [CustomerInfo(
            id=r['id'],
            customer_number=r['customer_number'],
            name=r['name'],
            email=r['email'],
            phone=r['phone'],
            city=r['city'],
        ) for r in rows]
        
        return CustomerSearchResponse(items=items, total=len(items))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler bei Kundensuche: {str(e)}")


@router.get("/suppliers/search", response_model=SupplierSearchResponse)
async def search_suppliers(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search suppliers in HUGWAWI"""
    from app.core.database import get_erp_db_connection
    
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        search_pattern = f"%{q}%"
        
        cursor.execute("""
            SELECT 
                s.id,
                s.suppliernumber as supplier_number,
                s.name,
                s.email,
                s.phone,
                s.city
            FROM supplier s
            WHERE s.name LIKE %s 
               OR s.suppliernumber LIKE %s 
               OR s.email LIKE %s
            ORDER BY s.name
            LIMIT %s
        """, (search_pattern, search_pattern, search_pattern, limit))
        
        rows = cursor.fetchall()
        cursor.close()
        erp_conn.close()
        
        items = [SupplierInfo(
            id=r['id'],
            supplier_number=r['supplier_number'],
            name=r['name'],
            email=r['email'],
            phone=r['phone'],
            city=r['city'],
        ) for r in rows]
        
        return SupplierSearchResponse(items=items, total=len(items))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler bei Lieferantensuche: {str(e)}")


# ============== Email Sending ==============

@router.post("/send-email", response_model=EmailSendResponse)
async def send_email_endpoint(
    payload: EmailSendRequest,
    db: Session = Depends(get_db),
):
    """
    E-Mail über SMTP versenden.
    
    Verwendet die konfigurierte Mailbox zum Senden und speichert die E-Mail
    als Kommunikationseintrag mit optionaler Kunden-/Dokumentverknüpfung.
    """
    from app.services.crm_email_service import send_email
    
    # Get user signature if requested
    user_signature_id = None
    if payload.include_signature:
        # Get default signature for the mailbox or first active signature
        signature = db.query(CRMUserSignature).filter(
            CRMUserSignature.is_default == True
        ).first()
        if signature:
            user_signature_id = signature.id
    
    # Send email
    result = send_email(
        db=db,
        mailbox_id=payload.mailbox_id,
        to_emails=payload.to_emails,
        subject=payload.subject,
        body_html=payload.body_html,
        body_text=payload.body_text,
        cc_emails=payload.cc_emails,
        bcc_emails=payload.bcc_emails,
        erp_customer_id=payload.erp_customer_id,
        erp_supplier_id=payload.erp_supplier_id,
        user_signature_id=user_signature_id,
    )
    
    if not result.success:
        return EmailSendResponse(
            success=False,
            error=result.error
        )
    
    # Add document links if provided
    if payload.document_links and result.communication_id:
        for link_data in payload.document_links:
            link = CRMCommunicationLink(
                communication_id=result.communication_id,
                link_type=link_data.link_type.value,
                erp_document_id=link_data.erp_document_id,
                erp_document_number=link_data.erp_document_number,
                is_auto_assigned=False,
            )
            db.add(link)
        db.commit()
    
    # Add lead link if provided
    if payload.lead_id and result.communication_id:
        comm = db.query(CRMCommunicationEntry).filter(
            CRMCommunicationEntry.id == result.communication_id
        ).first()
        if comm:
            # Store lead reference (could be extended in the model)
            _log_audit(db, "email", result.communication_id, "send", 
                      new_values={"lead_id": payload.lead_id, "to": payload.to_emails})
            db.commit()
    
    return EmailSendResponse(
        success=True,
        communication_id=result.communication_id,
        message_id=result.message_id
    )


@router.post("/templates/render", response_model=TemplateRenderResponse)
async def render_template_endpoint(
    payload: TemplateRenderRequest,
    db: Session = Depends(get_db),
):
    """
    E-Mail-Vorlage mit Variablen rendern.
    
    Ersetzt Platzhalter wie {{customer_name}}, {{order_number}} etc.
    mit den übergebenen Werten.
    """
    template = db.query(CRMEmailTemplate).filter(
        CRMEmailTemplate.id == payload.template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    
    # Render subject and body
    subject = template.subject_template or ""
    body = template.body_template or ""
    
    # Replace variables
    for key, value in payload.variables.items():
        placeholder = "{{" + key + "}}"
        subject = subject.replace(placeholder, str(value) if value else "")
        body = body.replace(placeholder, str(value) if value else "")
    
    return TemplateRenderResponse(subject=subject, body=body)


@router.get("/templates/{template_id}/preview")
async def preview_template(
    template_id: int,
    customer_name: Optional[str] = None,
    customer_number: Optional[str] = None,
    order_number: Optional[str] = None,
    offer_number: Optional[str] = None,
    contact_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Vorschau einer Vorlage mit optionalen Beispieldaten.
    """
    template = db.query(CRMEmailTemplate).filter(
        CRMEmailTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    
    # Build variables from query params
    variables = {
        "customer_name": customer_name or "[Kundenname]",
        "customer_number": customer_number or "[Kundennummer]",
        "order_number": order_number or "[Auftragsnummer]",
        "offer_number": offer_number or "[Angebotsnummer]",
        "contact_name": contact_name or "[Ansprechpartner]",
        "date": datetime.now().strftime("%d.%m.%Y"),
        "company_name": "Ihre Firma",  # Could be loaded from settings
    }
    
    subject = template.subject_template or ""
    body = template.body_template or ""
    
    for key, value in variables.items():
        placeholder = "{{" + key + "}}"
        subject = subject.replace(placeholder, str(value))
        body = body.replace(placeholder, str(value))
    
    return {
        "template_id": template_id,
        "template_name": template.name,
        "subject": subject,
        "body": body,
        "available_variables": list(variables.keys())
    }
