from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.import_job import ImportJob
from app.models.article import Article
import httpx
from app.schemas.import_job import ImportJobRead

router = APIRouter()


@router.get("/import-jobs/{job_id}", response_model=ImportJobRead)
def get_import_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import-Job nicht gefunden")
    # #region agent log
    try:
        import json, time
        article_count = None
        if job.bom_id:
            try:
                article_count = db.query(Article.id).filter(Article.bom_id == job.bom_id).count()
            except Exception:
                article_count = None
        payload = {
            "sessionId": "debug-session",
            "runId": "import-job",
            "hypothesisId": "JOB_POLL",
            "location": "backend/app/api/routes/import_jobs.py:get_import_job",
            "message": "poll",
            "data": {
                "job_id": job.id,
                "status": job.status,
                "step": job.step,
                "percent": job.percent,
                "bom_id": job.bom_id,
                "article_count": article_count,
            },
            "timestamp": int(time.time() * 1000),
        }
        try:
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps(payload) + "\n")
        except Exception:
            try:
                httpx.post(
                    "http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70",
                    json=payload,
                    timeout=2,
                )
            except Exception:
                pass
    except Exception:
        pass
    # #endregion agent log
    return job

