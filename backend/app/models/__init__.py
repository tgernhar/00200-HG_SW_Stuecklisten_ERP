# SQLAlchemy Models
from app.models.project import Project
from app.models.bom import Bom
from app.models.article import Article
from app.models.order import Order
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag
from app.models.import_job import ImportJob
from app.models.userlogin_log import UserLoginLog
from app.models.hierarchy_remark import HierarchyRemark
# PPS Models
from app.models.pps_todo import (
    PPSTodo,
    PPSTodoSegment,
    PPSTodoDependency,
    PPSResourceCache,
    PPSConflict,
    PPSAuditLog,
)
# CRM Models
from app.models.crm import (
    CRMMailbox,
    CRMCommunicationEntry,
    CRMCommunicationAttachment,
    CRMCommunicationLink,
    CRMTag,
    CRMCustomerTag,
    CRMLead,
    CRMLeadTag,
    CRMTask,
    CRMEmailTemplate,
    CRMUserSignature,
    CRMAssignmentRule,
    CRMAuditLog,
)

__all__ = [
    "Project", "Bom", "Article", "Order", "Document", "DocumentGenerationFlag",
    "ImportJob", "UserLoginLog", "HierarchyRemark",
    # PPS Models
    "PPSTodo", "PPSTodoSegment", "PPSTodoDependency", "PPSResourceCache",
    "PPSConflict", "PPSAuditLog",
    # CRM Models
    "CRMMailbox", "CRMCommunicationEntry", "CRMCommunicationAttachment",
    "CRMCommunicationLink", "CRMTag", "CRMCustomerTag", "CRMLead", "CRMLeadTag",
    "CRMTask", "CRMEmailTemplate", "CRMUserSignature", "CRMAssignmentRule", "CRMAuditLog",
]
