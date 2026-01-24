"""
Hierarchy Remarks API Routes
CRUD operations for remarks on hierarchical HUGWAWI elements.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db, get_erp_db_connection
from app.models.hierarchy_remark import HierarchyRemark

router = APIRouter()


# Pydantic Schemas
class RemarkCreate(BaseModel):
    """Schema for creating/updating a remark"""
    level_type: str
    hugwawi_id: int
    remark: str
    created_by: Optional[str] = None


class RemarkResponse(BaseModel):
    """Schema for remark response"""
    id: int
    level_type: str
    hugwawi_id: int
    remark: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RemarkListResponse(BaseModel):
    """Schema for list of remarks"""
    items: List[RemarkResponse]
    total: int


class ChildRemarkInfo(BaseModel):
    """Schema for child remark information (shown when parent is collapsed)"""
    level_type: str
    hugwawi_id: int
    remark: str
    truncated_remark: str  # Max 50 chars with ...


class ChildRemarksResponse(BaseModel):
    """Schema for child remarks response"""
    items: List[ChildRemarkInfo]
    total: int


class ChildRemarkDetail(BaseModel):
    """Detailed child remark with navigation info"""
    id: int
    level_type: str
    hugwawi_id: int
    remark: str
    path: str  # e.g., "Artikel: ART-001 > Stückliste: Pos 3"
    order_article_id: Optional[int] = None
    bom_detail_id: Optional[int] = None


class ChildRemarksSummary(BaseModel):
    """Summary of all child remarks for an order"""
    total_count: int
    by_level: Dict[str, int]  # {'order_article': 2, 'bom_detail': 5, 'workplan_detail': 1}
    items: List[ChildRemarkDetail]


# Valid level types
VALID_LEVEL_TYPES = ['order', 'order_article', 'bom_detail', 'workplan_detail']


def truncate_text(text: str, max_length: int = 50) -> str:
    """Truncate text to max_length with ... if needed"""
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."


# IMPORTANT: More specific routes MUST come BEFORE generic routes!
# Otherwise FastAPI will match /by-level/order_article as {level_type}=by-level, {hugwawi_id}=order_article

@router.get("/hierarchy-remarks/child-summary/{order_id}", response_model=ChildRemarksSummary)
async def get_child_remarks_summary(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a summary of all child remarks for an order.
    
    This endpoint queries the HUGWAWI database to find all related elements
    (order_articles, bom_details, workplan_details) for the given order,
    then returns any remarks associated with those elements.
    
    Returns:
        total_count: Total number of child remarks
        by_level: Count of remarks per level type
        items: List of remarks with navigation information
    """
    erp_connection = None
    try:
        erp_connection = get_erp_db_connection()
        cursor = erp_connection.cursor(dictionary=True)
        
        # Step 1: Get all order_article IDs for this order
        cursor.execute("""
            SELECT oa.id as order_article_id, a.articlenumber, a.description
            FROM order_article_ref oar
            JOIN order_article oa ON oar.orderArticleId = oa.id
            JOIN article a ON oa.articleid = a.id
            WHERE oar.orderid = %s
        """, (order_id,))
        order_articles = cursor.fetchall()
        order_article_ids = [oa['order_article_id'] for oa in order_articles]
        order_article_info = {oa['order_article_id']: oa for oa in order_articles}
        
        # Step 2: Get all packingnote_details (BOM) IDs for these articles
        bom_details = []
        bom_detail_ids = []
        bom_detail_info = {}
        
        if order_article_ids:
            placeholders = ','.join(['%s'] * len(order_article_ids))
            cursor.execute(f"""
                SELECT pd.id as detail_id, pd.pos, oa.id as order_article_id, a.articlenumber, a.description
                FROM order_article oa
                JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                JOIN packingnote_details pd ON pd.id = pnr.detail
                LEFT JOIN article a ON a.id = pd.article
                WHERE oa.id IN ({placeholders})
            """, order_article_ids)
            bom_details = cursor.fetchall()
            bom_detail_ids = [bd['detail_id'] for bd in bom_details]
            bom_detail_info = {bd['detail_id']: bd for bd in bom_details}
        
        # Step 3: Get all workplan_details IDs for these BOM details
        workplan_details = []
        workplan_detail_ids = []
        workplan_detail_info = {}
        
        if bom_detail_ids:
            placeholders = ','.join(['%s'] * len(bom_detail_ids))
            cursor.execute(f"""
                SELECT wpd.id as workplan_detail_id, wpd.pos, wp.packingnoteid as bom_detail_id,
                       ws.name as workstep_name
                FROM workplan wp
                JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                JOIN workplan_details wpd ON wpd.id = wpr.detail
                LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                LEFT JOIN workstep ws ON ws.id = qiws.workstep
                WHERE wp.packingnoteid IN ({placeholders})
            """, bom_detail_ids)
            workplan_details = cursor.fetchall()
            workplan_detail_ids = [wd['workplan_detail_id'] for wd in workplan_details]
            workplan_detail_info = {wd['workplan_detail_id']: wd for wd in workplan_details}
        
        cursor.close()
        
        # Step 4: Get remarks from local database for all these IDs
        items = []
        by_level = {'order_article': 0, 'bom_detail': 0, 'workplan_detail': 0}
        
        # Get order_article remarks
        if order_article_ids:
            remarks = db.query(HierarchyRemark).filter(
                HierarchyRemark.level_type == 'order_article',
                HierarchyRemark.hugwawi_id.in_(order_article_ids)
            ).all()
            
            for r in remarks:
                info = order_article_info.get(r.hugwawi_id, {})
                path = f"Artikel: {info.get('articlenumber', 'N/A')}"
                items.append(ChildRemarkDetail(
                    id=r.id,
                    level_type=r.level_type,
                    hugwawi_id=r.hugwawi_id,
                    remark=r.remark,
                    path=path,
                    order_article_id=r.hugwawi_id
                ))
                by_level['order_article'] += 1
        
        # Get bom_detail remarks
        if bom_detail_ids:
            remarks = db.query(HierarchyRemark).filter(
                HierarchyRemark.level_type == 'bom_detail',
                HierarchyRemark.hugwawi_id.in_(bom_detail_ids)
            ).all()
            
            for r in remarks:
                info = bom_detail_info.get(r.hugwawi_id, {})
                oa_id = info.get('order_article_id')
                oa_info = order_article_info.get(oa_id, {}) if oa_id else {}
                path = f"Artikel: {oa_info.get('articlenumber', 'N/A')} > Stückliste: Pos {info.get('pos', '?')}"
                items.append(ChildRemarkDetail(
                    id=r.id,
                    level_type=r.level_type,
                    hugwawi_id=r.hugwawi_id,
                    remark=r.remark,
                    path=path,
                    order_article_id=oa_id,
                    bom_detail_id=r.hugwawi_id
                ))
                by_level['bom_detail'] += 1
        
        # Get workplan_detail remarks
        if workplan_detail_ids:
            remarks = db.query(HierarchyRemark).filter(
                HierarchyRemark.level_type == 'workplan_detail',
                HierarchyRemark.hugwawi_id.in_(workplan_detail_ids)
            ).all()
            
            for r in remarks:
                info = workplan_detail_info.get(r.hugwawi_id, {})
                bd_id = info.get('bom_detail_id')
                bd_info = bom_detail_info.get(bd_id, {}) if bd_id else {}
                oa_id = bd_info.get('order_article_id')
                oa_info = order_article_info.get(oa_id, {}) if oa_id else {}
                path = f"Artikel: {oa_info.get('articlenumber', 'N/A')} > Stückliste: Pos {bd_info.get('pos', '?')} > Arbeitsgang: {info.get('workstep_name', 'N/A')}"
                items.append(ChildRemarkDetail(
                    id=r.id,
                    level_type=r.level_type,
                    hugwawi_id=r.hugwawi_id,
                    remark=r.remark,
                    path=path,
                    order_article_id=oa_id,
                    bom_detail_id=bd_id
                ))
                by_level['workplan_detail'] += 1
        
        total_count = sum(by_level.values())
        
        return ChildRemarksSummary(
            total_count=total_count,
            by_level=by_level,
            items=items
        )
        
    except Exception as e:
        print(f"Error fetching child remarks summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Kind-Bemerkungen: {str(e)}"
        )
    finally:
        if erp_connection:
            erp_connection.close()


@router.get("/hierarchy-remarks/by-level/{level_type}", response_model=RemarkListResponse)
async def get_remarks_by_level(
    level_type: str,
    hugwawi_ids: str = Query(..., description="Comma-separated list of HUGWAWI IDs"),
    db: Session = Depends(get_db)
):
    """
    Get remarks for multiple elements of the same level type.
    Useful for batch loading remarks when displaying a list.
    
    - **level_type**: 'order', 'order_article', 'bom_detail', or 'workplan_detail'
    - **hugwawi_ids**: Comma-separated list of HUGWAWI IDs (e.g., "1,2,3,4")
    """
    if level_type not in VALID_LEVEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid level_type. Must be one of: {VALID_LEVEL_TYPES}")
    
    try:
        id_list = [int(id.strip()) for id in hugwawi_ids.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hugwawi_ids format. Must be comma-separated integers.")
    
    remarks = db.query(HierarchyRemark).filter(
        HierarchyRemark.level_type == level_type,
        HierarchyRemark.hugwawi_id.in_(id_list)
    ).all()
    
    return RemarkListResponse(items=remarks, total=len(remarks))


@router.get("/hierarchy-remarks/children/{level_type}/{hugwawi_id}", response_model=ChildRemarksResponse)
async def get_child_remarks(
    level_type: str,
    hugwawi_id: int,
    db: Session = Depends(get_db)
):
    """
    Get remarks from child levels (for display when parent is collapsed).
    
    Returns remarks from all levels below the specified level.
    - 'order' → returns remarks from 'order_article', 'bom_detail', 'workplan_detail'
    - 'order_article' → returns remarks from 'bom_detail', 'workplan_detail'
    - 'bom_detail' → returns remarks from 'workplan_detail'
    - 'workplan_detail' → returns empty (no children)
    
    Note: This is a simplified implementation that returns all remarks
    for child level types. For accurate parent-child relationships,
    the HUGWAWI database would need to be queried.
    """
    if level_type not in VALID_LEVEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid level_type. Must be one of: {VALID_LEVEL_TYPES}")
    
    # Determine child level types
    child_types = []
    if level_type == 'order':
        child_types = ['order_article', 'bom_detail', 'workplan_detail']
    elif level_type == 'order_article':
        child_types = ['bom_detail', 'workplan_detail']
    elif level_type == 'bom_detail':
        child_types = ['workplan_detail']
    # workplan_detail has no children
    
    if not child_types:
        return ChildRemarksResponse(items=[], total=0)
    
    # For now, we return all remarks from child levels
    # In a full implementation, we would query HUGWAWI to get actual child IDs
    # This simplified version just shows that child remarks exist
    
    remarks = db.query(HierarchyRemark).filter(
        HierarchyRemark.level_type.in_(child_types)
    ).limit(10).all()  # Limit to prevent overload
    
    items = [
        ChildRemarkInfo(
            level_type=r.level_type,
            hugwawi_id=r.hugwawi_id,
            remark=r.remark,
            truncated_remark=truncate_text(r.remark, 50)
        )
        for r in remarks
    ]
    
    return ChildRemarksResponse(items=items, total=len(items))


# Generic routes AFTER specific routes
@router.get("/hierarchy-remarks/{level_type}/{hugwawi_id}", response_model=Optional[RemarkResponse])
async def get_remark(
    level_type: str,
    hugwawi_id: int,
    db: Session = Depends(get_db)
):
    """
    Get remark for a specific element.
    
    - **level_type**: 'order', 'order_article', 'bom_detail', or 'workplan_detail'
    - **hugwawi_id**: The HUGWAWI ID of the element
    """
    if level_type not in VALID_LEVEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid level_type. Must be one of: {VALID_LEVEL_TYPES}")
    
    remark = db.query(HierarchyRemark).filter(
        HierarchyRemark.level_type == level_type,
        HierarchyRemark.hugwawi_id == hugwawi_id
    ).first()
    
    return remark


@router.post("/hierarchy-remarks", response_model=RemarkResponse)
async def save_remark(
    data: RemarkCreate,
    db: Session = Depends(get_db)
):
    """
    Create or update a remark for an element.
    If a remark already exists for the level_type/hugwawi_id combination, it will be updated.
    """
    if data.level_type not in VALID_LEVEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid level_type. Must be one of: {VALID_LEVEL_TYPES}")
    
    # Check if remark already exists
    existing = db.query(HierarchyRemark).filter(
        HierarchyRemark.level_type == data.level_type,
        HierarchyRemark.hugwawi_id == data.hugwawi_id
    ).first()
    
    if existing:
        # Update existing remark
        existing.remark = data.remark
        existing.created_by = data.created_by
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new remark
        new_remark = HierarchyRemark(
            level_type=data.level_type,
            hugwawi_id=data.hugwawi_id,
            remark=data.remark,
            created_by=data.created_by,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_remark)
        db.commit()
        db.refresh(new_remark)
        return new_remark


@router.delete("/hierarchy-remarks/{remark_id}")
async def delete_remark(
    remark_id: int,
    db: Session = Depends(get_db)
):
    """Delete a remark by its ID."""
    remark = db.query(HierarchyRemark).filter(HierarchyRemark.id == remark_id).first()
    
    if not remark:
        raise HTTPException(status_code=404, detail="Remark not found")
    
    db.delete(remark)
    db.commit()
    
    return {"message": "Remark deleted", "id": remark_id}
