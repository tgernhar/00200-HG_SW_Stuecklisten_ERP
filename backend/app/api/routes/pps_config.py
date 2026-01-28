"""
PPS Configuration API Routes

Endpoints for production planning configuration:
- Working hours (core time) management
- Filter presets for PPS pages
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import time, datetime

from app.core.database import get_db
from app.models.pps_todo import PPSWorkingHours, PPSUserFilterPreset, PPSTodoTypeConfig
from app.schemas.pps import (
    WorkingHours, WorkingHoursUpdate, WorkingHoursListResponse,
    FilterPreset, FilterPresetCreate, FilterPresetUpdate, FilterPresetList, FilterPresetConfig,
    TodoTypeConfig, TodoTypeConfigCreate, TodoTypeConfigUpdate, TodoTypeConfigList
)


router = APIRouter(prefix="/pps/config", tags=["PPS Configuration"])


# Day names in German
DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

# Default working hours (Mon-Fri 07:00-16:00)
DEFAULT_HOURS = [
    {"day_of_week": 0, "start_time": "07:00", "end_time": "16:00", "is_working_day": True},
    {"day_of_week": 1, "start_time": "07:00", "end_time": "16:00", "is_working_day": True},
    {"day_of_week": 2, "start_time": "07:00", "end_time": "16:00", "is_working_day": True},
    {"day_of_week": 3, "start_time": "07:00", "end_time": "16:00", "is_working_day": True},
    {"day_of_week": 4, "start_time": "07:00", "end_time": "16:00", "is_working_day": True},
    {"day_of_week": 5, "start_time": None, "end_time": None, "is_working_day": False},
    {"day_of_week": 6, "start_time": None, "end_time": None, "is_working_day": False},
]


def _time_to_string(t: time) -> str:
    """Convert time object to HH:MM string"""
    if t is None:
        return None
    return t.strftime("%H:%M")


def _string_to_time(s: str) -> time:
    """Convert HH:MM string to time object"""
    if not s:
        return None
    parts = s.split(":")
    return time(int(parts[0]), int(parts[1]))


def _db_to_schema(db_obj: PPSWorkingHours) -> WorkingHours:
    """Convert database object to schema"""
    return WorkingHours(
        id=db_obj.id,
        day_of_week=db_obj.day_of_week,
        day_name=DAY_NAMES[db_obj.day_of_week] if 0 <= db_obj.day_of_week <= 6 else "",
        start_time=_time_to_string(db_obj.start_time),
        end_time=_time_to_string(db_obj.end_time),
        is_working_day=db_obj.is_working_day,
        created_at=db_obj.created_at,
        updated_at=db_obj.updated_at,
    )


@router.get("/working-hours", response_model=WorkingHoursListResponse)
async def get_working_hours(db: Session = Depends(get_db)):
    """Get all 7 days of working hours configuration.
    
    Returns default values if no configuration exists.
    """
    hours = db.query(PPSWorkingHours).order_by(PPSWorkingHours.day_of_week).all()
    
    # If empty, return defaults (but don't persist yet)
    if not hours:
        items = []
        for default in DEFAULT_HOURS:
            items.append(WorkingHours(
                id=0,
                day_of_week=default["day_of_week"],
                day_name=DAY_NAMES[default["day_of_week"]],
                start_time=default["start_time"],
                end_time=default["end_time"],
                is_working_day=default["is_working_day"],
            ))
        return WorkingHoursListResponse(items=items)
    
    # Convert to schema objects
    items = [_db_to_schema(h) for h in hours]
    return WorkingHoursListResponse(items=items)


@router.put("/working-hours", response_model=WorkingHoursListResponse)
async def update_working_hours(
    payload: List[WorkingHoursUpdate],
    db: Session = Depends(get_db)
):
    """Update all 7 days of working hours configuration.
    
    Expects a list of 7 items, one for each day of the week (0=Monday to 6=Sunday).
    """
    if len(payload) != 7:
        raise HTTPException(
            status_code=400,
            detail="Exactly 7 days required (0=Montag to 6=Sonntag)"
        )
    
    # Validate day_of_week values
    expected_days = set(range(7))
    received_days = set(item.day_of_week for item in payload)
    if received_days != expected_days:
        raise HTTPException(
            status_code=400,
            detail="All days from 0 (Montag) to 6 (Sonntag) must be provided"
        )
    
    # Get existing records or create new ones
    existing = {h.day_of_week: h for h in db.query(PPSWorkingHours).all()}
    
    result_items = []
    for item in payload:
        if item.day_of_week in existing:
            # Update existing
            db_obj = existing[item.day_of_week]
            db_obj.start_time = _string_to_time(item.start_time) if item.start_time else None
            db_obj.end_time = _string_to_time(item.end_time) if item.end_time else None
            db_obj.is_working_day = item.is_working_day
            db_obj.updated_at = datetime.utcnow()
        else:
            # Create new
            db_obj = PPSWorkingHours(
                day_of_week=item.day_of_week,
                start_time=_string_to_time(item.start_time) if item.start_time else None,
                end_time=_string_to_time(item.end_time) if item.end_time else None,
                is_working_day=item.is_working_day,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(db_obj)
        
        result_items.append(db_obj)
    
    db.commit()
    
    # Refresh and return
    for obj in result_items:
        db.refresh(obj)
    
    # Sort by day_of_week and convert to schema
    result_items.sort(key=lambda x: x.day_of_week)
    return WorkingHoursListResponse(items=[_db_to_schema(h) for h in result_items])


# ============== Filter Presets ==============

@router.get("/filter-presets", response_model=FilterPresetList)
async def get_filter_presets(
    page: str,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Get all filter presets for a user on a specific page.
    
    Args:
        page: Page identifier (e.g., "todo_list", "planboard")
        user_id: User ID from header
    """
    presets = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.user_id == user_id,
        PPSUserFilterPreset.page == page
    ).order_by(
        PPSUserFilterPreset.is_favorite.desc(),
        PPSUserFilterPreset.name
    ).all()
    
    return FilterPresetList(items=presets)


@router.get("/filter-presets/favorite", response_model=Optional[FilterPreset])
async def get_favorite_preset(
    page: str,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Get the favorite preset for a user on a specific page.
    
    Returns None if no favorite is set.
    """
    preset = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.user_id == user_id,
        PPSUserFilterPreset.page == page,
        PPSUserFilterPreset.is_favorite == True
    ).first()
    
    if not preset:
        return None
    
    return preset


@router.post("/filter-presets", response_model=FilterPreset)
async def create_filter_preset(
    payload: FilterPresetCreate,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Create a new filter preset.
    
    The first preset for a page is automatically set as favorite.
    """
    # Check if this is the first preset for this page
    existing_count = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.user_id == user_id,
        PPSUserFilterPreset.page == payload.page
    ).count()
    
    preset = PPSUserFilterPreset(
        user_id=user_id,
        name=payload.name,
        page=payload.page,
        is_favorite=(existing_count == 0),  # First one is favorite
        filter_config=payload.filter_config.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(preset)
    db.commit()
    db.refresh(preset)
    
    return preset


@router.patch("/filter-presets/{preset_id}", response_model=FilterPreset)
async def update_filter_preset(
    preset_id: int,
    payload: FilterPresetUpdate,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Update a filter preset (partial update)."""
    preset = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.id == preset_id,
        PPSUserFilterPreset.user_id == user_id  # Security: only own presets
    ).first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset nicht gefunden")
    
    if payload.name is not None:
        preset.name = payload.name
    
    if payload.filter_config is not None:
        preset.filter_config = payload.filter_config.model_dump()
    
    if payload.is_favorite is not None:
        preset.is_favorite = payload.is_favorite
    
    preset.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(preset)
    
    return preset


@router.delete("/filter-presets/{preset_id}")
async def delete_filter_preset(
    preset_id: int,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Delete a filter preset."""
    preset = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.id == preset_id,
        PPSUserFilterPreset.user_id == user_id  # Security: only own presets
    ).first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset nicht gefunden")
    
    was_favorite = preset.is_favorite
    page = preset.page
    
    db.delete(preset)
    db.commit()
    
    # If deleted preset was favorite, make another one favorite
    if was_favorite:
        next_preset = db.query(PPSUserFilterPreset).filter(
            PPSUserFilterPreset.user_id == user_id,
            PPSUserFilterPreset.page == page
        ).first()
        
        if next_preset:
            next_preset.is_favorite = True
            db.commit()
    
    return {"message": "Preset gelöscht", "id": preset_id}


@router.post("/filter-presets/{preset_id}/set-favorite", response_model=FilterPreset)
async def set_favorite_preset(
    preset_id: int,
    user_id: int = Header(alias="X-User-ID"),
    db: Session = Depends(get_db)
):
    """Set a preset as favorite (removes favorite from others on same page)."""
    preset = db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.id == preset_id,
        PPSUserFilterPreset.user_id == user_id
    ).first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset nicht gefunden")
    
    # Remove favorite from all other presets on same page
    db.query(PPSUserFilterPreset).filter(
        PPSUserFilterPreset.user_id == user_id,
        PPSUserFilterPreset.page == preset.page,
        PPSUserFilterPreset.id != preset_id
    ).update({"is_favorite": False})
    
    # Set this one as favorite
    preset.is_favorite = True
    preset.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(preset)
    
    return preset


# ============== Todo Type Configuration ==============

@router.get("/todo-types", response_model=TodoTypeConfigList)
async def get_todo_type_configs(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get all todo type configurations."""
    query = db.query(PPSTodoTypeConfig)
    
    if is_active is not None:
        query = query.filter(PPSTodoTypeConfig.is_active == is_active)
    
    configs = query.order_by(PPSTodoTypeConfig.sort_order).all()
    return TodoTypeConfigList(items=configs)


@router.get("/todo-types/{todo_type}", response_model=TodoTypeConfig)
async def get_todo_type_config(
    todo_type: str,
    db: Session = Depends(get_db)
):
    """Get specific todo type configuration."""
    config = db.query(PPSTodoTypeConfig).filter(
        PPSTodoTypeConfig.todo_type == todo_type
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Todo-Typ '{todo_type}' nicht gefunden")
    
    return config


@router.put("/todo-types/{todo_type}", response_model=TodoTypeConfig)
async def update_todo_type_config(
    todo_type: str,
    data: TodoTypeConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update todo type configuration."""
    config = db.query(PPSTodoTypeConfig).filter(
        PPSTodoTypeConfig.todo_type == todo_type
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Todo-Typ '{todo_type}' nicht gefunden")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    return config


def get_todo_type_config_cached(db: Session, todo_type: str) -> Optional[PPSTodoTypeConfig]:
    """Get todo type config from DB (helper for other modules)."""
    return db.query(PPSTodoTypeConfig).filter(
        PPSTodoTypeConfig.todo_type == todo_type,
        PPSTodoTypeConfig.is_active == True
    ).first()


def format_todo_title(config: PPSTodoTypeConfig, **kwargs) -> str:
    """Format todo title using the template from config.
    
    Available placeholders:
    - {prefix}: title_prefix from config
    - {name}: order name, article name, etc.
    - {position}: position number
    - {pos}: BOM/workstep position
    - {articlenumber}: article number
    - {workstep_name}: workstep name
    - {title}: custom title
    """
    template = config.title_template
    prefix = config.title_prefix or ""
    
    # Build replacement dict
    replacements = {
        "prefix": prefix,
        **kwargs
    }
    
    # Replace placeholders
    result = template
    for key, value in replacements.items():
        result = result.replace(f"{{{key}}}", str(value) if value is not None else "")
    
    return result.strip()


# ============== Gantt Configuration ==============

from app.models.pps_todo import PPSGanttConfig
from app.schemas.pps import GanttConfig, GanttConfigList, GanttConfigDict, GanttConfigUpdate


@router.get("/gantt-config", response_model=GanttConfigList)
async def get_gantt_configs(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all Gantt configuration settings."""
    query = db.query(PPSGanttConfig)
    
    if category:
        query = query.filter(PPSGanttConfig.category == category)
    
    configs = query.order_by(PPSGanttConfig.category, PPSGanttConfig.config_key).all()
    return GanttConfigList(items=configs)


@router.get("/gantt-config/dict", response_model=GanttConfigDict)
async def get_gantt_config_dict(
    db: Session = Depends(get_db)
):
    """Get Gantt config as key-value dictionary for easy frontend access.
    
    Values are automatically converted to their proper types (int, float, bool).
    """
    configs = db.query(PPSGanttConfig).all()
    
    result = {}
    for cfg in configs:
        # Convert value to proper type
        if cfg.config_type == 'int':
            result[cfg.config_key] = int(cfg.config_value)
        elif cfg.config_type == 'float':
            result[cfg.config_key] = float(cfg.config_value)
        elif cfg.config_type == 'bool':
            result[cfg.config_key] = cfg.config_value.lower() in ('true', '1', 'yes')
        else:
            result[cfg.config_key] = cfg.config_value
    
    return GanttConfigDict(config=result)


@router.get("/gantt-config/{config_key}", response_model=GanttConfig)
async def get_gantt_config(
    config_key: str,
    db: Session = Depends(get_db)
):
    """Get specific Gantt config by key."""
    config = db.query(PPSGanttConfig).filter(
        PPSGanttConfig.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Gantt-Konfiguration '{config_key}' nicht gefunden")
    
    return config


@router.put("/gantt-config/{config_key}", response_model=GanttConfig)
async def update_gantt_config(
    config_key: str,
    data: GanttConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update Gantt config value."""
    config = db.query(PPSGanttConfig).filter(
        PPSGanttConfig.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Gantt-Konfiguration '{config_key}' nicht gefunden")
    
    config.config_value = data.config_value
    db.commit()
    db.refresh(config)
    
    return config
