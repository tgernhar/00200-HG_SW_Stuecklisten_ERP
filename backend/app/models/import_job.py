from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False, index=True)

    assembly_filepath = Column(Text, nullable=False)

    # queued | running | done | failed | cancelled
    status = Column(String(20), nullable=False, default="queued", index=True)

    # validate | connector | processing | db_write | finalize
    step = Column(String(50), nullable=True)

    # 0..100 (optional / coarse)
    percent = Column(Integer, nullable=True)

    message = Column(Text, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

