from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.import_job import ImportJob
from app.schemas.import_job import ImportJobRead
import time as _time
import json as _json

router = APIRouter()

# region agent log
def _dbg_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        payload = {
            "sessionId": "debug-session",
            "runId": "import-error",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(_time.time() * 1000),
        }
        with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write(_json.dumps(payload) + "\n")
    except Exception:
        pass
# endregion

@router.get("/import-jobs/{job_id}", response_model=ImportJobRead)
def get_import_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import-Job nicht gefunden")
    # region agent log
    _dbg_log(
        "H6_JOB",
        "backend/app/api/routes/import_jobs.py:get_import_job",
        "job_status",
        {"job_id": job_id, "status": job.status, "step": job.step, "percent": job.percent},
    )
    # endregion
    return job

