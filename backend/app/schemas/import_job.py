from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


ImportJobStatus = Literal["queued", "running", "done", "failed", "cancelled"]


class ImportJobCreate(BaseModel):
    project_id: int
    bom_id: int
    assembly_filepath: str


class ImportJobRead(BaseModel):
    id: int
    project_id: int
    bom_id: int
    assembly_filepath: str

    status: ImportJobStatus
    step: Optional[str] = None
    percent: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None

    created_at: datetime
    started_at: Optional[datetime] = None
    updated_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True

