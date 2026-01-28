from __future__ import annotations

import asyncio
import threading
import time
import json as _json
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.import_job import ImportJob
from app.services.solidworks_service import import_solidworks_assembly

# Simple in-process concurrency limit (1 running import at a time by default).
_IMPORT_SEMAPHORE = threading.Semaphore(1)


def _now():
    return datetime.utcnow()


def _dbg_log(*args, **kwargs):
    """Debug logging disabled - no-op function"""
    pass


def create_import_job(db: Session, *, project_id: int, bom_id: int, assembly_filepath: str) -> ImportJob:
    job = ImportJob(
        project_id=project_id,
        bom_id=bom_id,
        assembly_filepath=assembly_filepath,
        status="queued",
        step="validate",
        percent=0,
        message="Wartet auf Start…",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def start_import_job(job_id: int) -> None:
    # Run in a daemon thread so the HTTP request can return immediately.
    # region agent log
    _dbg_log(
        "H1_THREAD",
        "backend/app/services/import_job_service.py:start_import_job",
        "thread_start_requested",
        {"job_id": job_id},
    )
    # endregion
    t = threading.Thread(target=_run_job_thread, args=(job_id,), daemon=True)
    t.start()


def _run_job_thread(job_id: int) -> None:
    # Ensure only one import runs at a time in this process.
    # region agent log
    _dbg_log(
        "H2_SEMA",
        "backend/app/services/import_job_service.py:_run_job_thread",
        "thread_enter",
        {"job_id": job_id},
    )
    # endregion
    with _IMPORT_SEMAPHORE:
        # region agent log
        _dbg_log(
            "H2_SEMA",
            "backend/app/services/import_job_service.py:_run_job_thread",
            "semaphore_acquired",
            {"job_id": job_id},
        )
        # endregion
        try:
            asyncio.run(_run_job_async(job_id))
        except Exception:
            # Last-resort: mark failed if possible.
            try:
                db = SessionLocal()
                job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
                if job and job.status not in ("done", "failed", "cancelled"):
                    job.status = "failed"
                    job.step = "finalize"
                    job.error = "Import-Worker abgestürzt (unhandled exception)."
                    job.finished_at = _now()
                    db.commit()
            except Exception:
                pass
            finally:
                try:
                    db.close()
                except Exception:
                    pass


async def _run_job_async(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
        if not job:
            return
        # region agent log
        _dbg_log(
            "H3_ASYNC",
            "backend/app/services/import_job_service.py:_run_job_async",
            "job_loaded",
            {"job_id": job_id, "status": getattr(job, "status", None), "step": getattr(job, "step", None)},
        )
        # endregion

        job.status = "running"
        job.step = "connector"
        job.percent = 5
        job.message = "SOLIDWORKS-Import läuft… (dies kann länger dauern)"
        job.started_at = _now()
        db.commit()
        # region agent log
        _dbg_log(
            "H3_ASYNC",
            "backend/app/services/import_job_service.py:_run_job_async",
            "job_marked_running",
            {"job_id": job_id},
        )
        # endregion

        # Run the existing import service (async).
        # region agent log
        _dbg_log(
            "H4_IMPORT",
            "backend/app/services/import_job_service.py:_run_job_async",
            "import_call_start",
            {"job_id": job_id, "project_id": job.project_id, "bom_id": job.bom_id},
        )
        # endregion
        result = await import_solidworks_assembly(job.project_id, job.bom_id, job.assembly_filepath, db)
        # region agent log
        _dbg_log(
            "H4_IMPORT",
            "backend/app/services/import_job_service.py:_run_job_async",
            "import_call_done",
            {"job_id": job_id, "result_type": str(type(result))},
        )
        # endregion
        if isinstance(result, dict) and result.get("success") is False:
            job.status = "failed"
            job.step = "finalize"
            job.percent = None
            job.error = str(result.get("error") or "SOLIDWORKS-Import fehlgeschlagen")
            job.message = "Fehlgeschlagen"
            job.finished_at = _now()
            db.commit()
            return

        if isinstance(result, dict):
            imported = result.get("imported_count")
            aggregated = result.get("aggregated_count")
            total_parts = result.get("total_parts_count")
            parts = []
            if imported is not None:
                parts.append(f"importiert {imported}")
            if aggregated is not None:
                parts.append(f"aggregiert {aggregated}")
            if total_parts is not None:
                parts.append(f"rows {total_parts}")
            if parts:
                job.message = "Fertig (" + ", ".join(parts) + ")"

        job.status = "done"
        job.step = "finalize"
        job.percent = 100
        if not job.message:
            job.message = "Fertig"
        job.finished_at = _now()
        db.commit()

    finally:
        db.close()

