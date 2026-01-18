"""
HUGWAWI read-only Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db, get_erp_db_connection

router = APIRouter()


@router.get("/hugwawi/orders/{au_nr}/articles")
async def get_hugwawi_order_articles(au_nr: str):
    """
    Liefert die Artikel-Zuordnung(en) eines Auftrags aus HUGWAWI (read-only).
    AU-Nr wird gegen ordertable.name gematcht.
    """
    from app.services.erp_service import list_order_articles_by_au_name

    erp = get_erp_db_connection()
    try:
        rows = list_order_articles_by_au_name(au_nr.strip(), erp)
        return {"au_nr": au_nr, "items": rows, "count": len(rows)}
    finally:
        erp.close()


@router.get("/hugwawi/bestellartikel-templates")
async def get_bestellartikel_templates():
    """
    Liefert HUGWAWI Artikel, deren Artikelnummer mit 099900- beginnt (read-only).
    """
    from app.services.erp_service import list_bestellartikel_templates

    erp = get_erp_db_connection()
    try:
        rows = list_bestellartikel_templates(erp)
        return {"items": rows, "count": len(rows)}
    finally:
        erp.close()


@router.get("/hugwawi/departments")
async def get_hugwawi_departments():
    """
    Liefert Abteilungen aus HUGWAWI (department.name).
    """
    from app.services.erp_service import list_departments

    erp = get_erp_db_connection()
    try:
        rows = list_departments(erp)
        return {"items": rows, "count": len(rows)}
    except Exception as e:
        # #region agent log
        try:
            import json, time
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "selectlists-1",
                    "hypothesisId": "SELECTLIST_ERR",
                    "location": "backend/app/api/routes/hugwawi.py:get_hugwawi_departments",
                    "message": "error",
                    "data": {"error": str(e)},
                    "timestamp": int(time.time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion agent log
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        erp.close()


@router.get("/hugwawi/selectlist-values/{selectlist_id}")
async def get_hugwawi_selectlist_values(selectlist_id: int):
    """
    Liefert Selectlist-Werte aus HUGWAWI (article_selectlist_value.value) für eine selectlist.
    """
    from app.services.erp_service import list_selectlist_values

    erp = get_erp_db_connection()
    try:
        rows = list_selectlist_values(selectlist_id, erp)
        return {"items": rows, "count": len(rows)}
    except Exception as e:
        # #region agent log
        try:
            import json, time
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "selectlists-1",
                    "hypothesisId": "SELECTLIST_ERR",
                    "location": "backend/app/api/routes/hugwawi.py:get_hugwawi_selectlist_values",
                    "message": "error",
                    "data": {"selectlist_id": selectlist_id, "error": str(e)},
                    "timestamp": int(time.time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion agent log
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        erp.close()

