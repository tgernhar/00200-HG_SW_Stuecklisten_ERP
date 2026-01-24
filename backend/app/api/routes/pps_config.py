"""
PPS Configuration API Routes

Endpoints for production planning configuration:
- Working hours (core time) management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import time, datetime

from app.core.database import get_db
from app.models.pps_todo import PPSWorkingHours
from app.schemas.pps import WorkingHours, WorkingHoursUpdate, WorkingHoursListResponse


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
