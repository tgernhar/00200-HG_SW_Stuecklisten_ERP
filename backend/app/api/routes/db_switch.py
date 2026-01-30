"""
Database Switch Routes

API endpoints for switching between Live HUGWAWI (10.233.159.44) 
and Test HUGWAWI (10.233.159.39) databases.

Features:
- Toggle between test and live database mode
- View and manage table registry for write permissions
- Feature can be completely disabled in production via DB_SWITCH_ENABLED setting
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db, set_test_db_mode, is_test_db_mode, get_current_erp_host
from app.core.config import settings
from app.models.hugwawi_table_registry import HugwawiTableRegistry

router = APIRouter()


# ============== Pydantic Schemas ==============

class DbSwitchStatus(BaseModel):
    """Response schema for database switch status"""
    is_test_mode: bool
    current_host: str
    live_host: str
    test_host: str
    feature_enabled: bool
    
    class Config:
        from_attributes = True


class DbSwitchToggleRequest(BaseModel):
    """Request schema for toggling database mode"""
    use_test_db: bool


class TableRegistryItem(BaseModel):
    """Response schema for a single table registry entry"""
    position: int
    table_name: str
    is_used_read: bool
    remarks: Optional[str]
    allow_write_production: bool
    
    class Config:
        from_attributes = True


class TableRegistryUpdateRequest(BaseModel):
    """Request schema for updating table registry entry"""
    remarks: Optional[str] = None
    allow_write_production: Optional[bool] = None


class TableRegistryResponse(BaseModel):
    """Response schema for table registry list"""
    items: List[TableRegistryItem]
    total: int
    is_test_mode: bool
    feature_enabled: bool


# ============== Endpoints ==============

@router.get("/db-switch/status", response_model=DbSwitchStatus)
async def get_db_switch_status():
    """
    Get the current database switch status.
    
    Returns:
        - is_test_mode: True if test DB is active
        - current_host: Currently active DB hostname
        - live_host: Live DB hostname (10.233.159.44)
        - test_host: Test DB hostname (10.233.159.39)
        - feature_enabled: Whether the switch feature is enabled
    """
    return DbSwitchStatus(
        is_test_mode=is_test_db_mode(),
        current_host=get_current_erp_host(),
        live_host=settings.ERP_DB_HOST,
        test_host=settings.ERP_TEST_DB_HOST,
        feature_enabled=settings.DB_SWITCH_ENABLED
    )


@router.post("/db-switch/toggle", response_model=DbSwitchStatus)
async def toggle_db_mode(request: DbSwitchToggleRequest):
    """
    Toggle between live and test database mode.
    
    Args:
        use_test_db: True to switch to test DB, False to switch to live DB.
        
    Returns:
        Updated database switch status.
        
    Note:
        - Live DB (10.233.159.44) is ALWAYS read-only
        - Test DB (10.233.159.39) allows reads and writes (when allowed by table registry)
    """
    if not settings.DB_SWITCH_ENABLED:
        raise HTTPException(
            status_code=403, 
            detail="Database switch feature is disabled"
        )
    
    set_test_db_mode(request.use_test_db)
    
    return DbSwitchStatus(
        is_test_mode=is_test_db_mode(),
        current_host=get_current_erp_host(),
        live_host=settings.ERP_DB_HOST,
        test_host=settings.ERP_TEST_DB_HOST,
        feature_enabled=settings.DB_SWITCH_ENABLED
    )


@router.get("/db-switch/table-registry", response_model=TableRegistryResponse)
async def get_table_registry(db: Session = Depends(get_db)):
    """
    Get all HUGWAWI tables with their usage and permission status.
    
    Returns:
        List of all 231 HUGWAWI tables with:
        - position: Sequential number
        - table_name: Name of the table
        - is_used_read: Whether table is used for reading
        - remarks: User remarks
        - allow_write_production: Whether writing is allowed (always 0 initially)
    """
    tables = db.query(HugwawiTableRegistry).order_by(HugwawiTableRegistry.position).all()
    
    return TableRegistryResponse(
        items=[TableRegistryItem.model_validate(t) for t in tables],
        total=len(tables),
        is_test_mode=is_test_db_mode(),
        feature_enabled=settings.DB_SWITCH_ENABLED
    )


@router.get("/db-switch/table-registry/{table_name}", response_model=TableRegistryItem)
async def get_table_registry_entry(table_name: str, db: Session = Depends(get_db)):
    """
    Get a specific table registry entry by table name.
    """
    table = db.query(HugwawiTableRegistry).filter(
        HugwawiTableRegistry.table_name == table_name
    ).first()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found in registry")
    
    return TableRegistryItem.model_validate(table)


@router.put("/db-switch/table-registry/{table_name}", response_model=TableRegistryItem)
async def update_table_registry_entry(
    table_name: str,
    request: TableRegistryUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update a table registry entry (remarks and/or write permission).
    
    Args:
        table_name: Name of the HUGWAWI table
        remarks: Optional remarks/notes
        allow_write_production: Whether writing to this table in production is allowed
        
    Returns:
        Updated table registry entry.
        
    Warning:
        Setting allow_write_production to True will enable write operations
        to the LIVE database (10.233.159.44) for this table. Use with extreme caution!
    """
    table = db.query(HugwawiTableRegistry).filter(
        HugwawiTableRegistry.table_name == table_name
    ).first()
    
    if not table:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found in registry")
    
    if request.remarks is not None:
        table.remarks = request.remarks
    
    if request.allow_write_production is not None:
        table.allow_write_production = request.allow_write_production
    
    db.commit()
    db.refresh(table)
    
    return TableRegistryItem.model_validate(table)


@router.get("/db-switch/can-write/{table_name}")
async def can_write_to_table(table_name: str, db: Session = Depends(get_db)):
    """
    Check if writing to a specific table is currently allowed.
    
    Writing is allowed only if:
    1. Test DB mode is active (is_test_mode = True)
    2. The table has allow_write_production = True in the registry
    
    Args:
        table_name: Name of the HUGWAWI table
        
    Returns:
        - can_write: Boolean indicating if writing is allowed
        - reason: Explanation of why writing is/isn't allowed
    """
    is_test = is_test_db_mode()
    
    table = db.query(HugwawiTableRegistry).filter(
        HugwawiTableRegistry.table_name == table_name
    ).first()
    
    if not table:
        return {
            "can_write": False,
            "table_name": table_name,
            "reason": "Table not found in registry",
            "is_test_mode": is_test,
            "allow_write_production": False
        }
    
    # Writing is allowed only in test mode AND if table has write permission
    can_write = is_test and table.allow_write_production
    
    if not is_test:
        reason = "Live database mode is active - all writes are blocked"
    elif not table.allow_write_production:
        reason = "Table does not have write permission enabled"
    else:
        reason = "Writing is allowed in test mode with write permission"
    
    return {
        "can_write": can_write,
        "table_name": table_name,
        "reason": reason,
        "is_test_mode": is_test,
        "allow_write_production": table.allow_write_production
    }
