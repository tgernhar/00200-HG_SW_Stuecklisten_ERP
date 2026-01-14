"""
SOLIDWORKS Service Layer
"""
from sqlalchemy.orm import Session
from app.models.article import Article
from app.models.project import Project
from app.core.config import settings
import httpx
import logging
import os
from collections import defaultdict

logger = logging.getLogger(__name__)
# Stelle sicher, dass der Logger die Handler vom Root-Logger erbt
logger.propagate = True
logger.setLevel(logging.DEBUG)  # Setze Level, damit alle Meldungen durchkommen


async def import_solidworks_assembly(
    project_id: int,
    assembly_filepath: str,
    db: Session
) -> dict:
    """
    Importiert SOLIDWORKS-Assembly entsprechend VBA Main_Create_Projektsheet()
    
    Workflow:
    1. Ruft SOLIDWORKS-Connector auf: get-all-parts-from-assembly
    2. Verarbeitet Ergebnis-Array (entspricht Main_GET_ALL_FROM_SW)
    3. Aggregiert Teile nach Name + Konfiguration (entspricht Main_SW_Import_To_Projectsheet)
    4. Speichert Artikel in Datenbank
    """
    # #region agent log
    # NDJSON debug log (repo root/.cursor/debug.log)
    _repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    _debug_log_path = os.path.join(_repo_root, ".cursor", "debug.log")
    try:
        with open(_debug_log_path, "a", encoding="utf-8") as _f:
            import time, json
            _f.write(json.dumps({
                "timestamp": int(time.time() * 1000),
                "location": "backend/app/services/solidworks_service.py:import_solidworks_assembly",
                "message": "ENTRY import_solidworks_assembly",
                "data": {"project_id": project_id, "assembly_filepath": assembly_filepath},
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "U1"
            }) + "\n")
    except Exception:
        pass
    # #endregion

    # 1. SOLIDWORKS-Connector aufrufen
    logger.info(f"Calling SOLIDWORKS-Connector with filepath: {assembly_filepath}")
    logger.info(f"SOLIDWORKS_CONNECTOR_URL: {settings.SOLIDWORKS_CONNECTOR_URL}")
    logger.info(f"Full URL: {settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/get-all-parts-from-assembly")
    logger.info(f"Request JSON: {{'assembly_filepath': '{assembly_filepath}'}}")
    
    async with httpx.AsyncClient(timeout=300.0) as client:  # 5 Minuten Timeout für große Assemblies
        try:
            request_url = f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/get-all-parts-from-assembly"
            request_json = {"assembly_filepath": assembly_filepath}
            logger.info(f"Sending POST request to: {request_url}")
            logger.info(f"Request body: {request_json}")
            
            response = await client.post(
                request_url,
                json=request_json
            )
            
            logger.info(f"SOLIDWORKS-Connector response status: {response.status_code}")
            logger.debug(f"SOLIDWORKS-Connector response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                error_detail = response.text if response.text else "Keine Fehlermeldung"
                logger.error(f"SOLIDWORKS-Connector error: {error_detail}")
                try:
                    error_json = response.json()
                    logger.error(f"SOLIDWORKS-Connector error JSON: {error_json}")
                except:
                    pass
                raise Exception(f"SOLIDWORKS-Connector Fehler: {response.status_code} - {error_detail}")
        except httpx.RequestError as e:
            logger.error(f"SOLIDWORKS-Connector request error: {e}", exc_info=True)
            raise Exception(f"SOLIDWORKS-Connector Verbindungsfehler: {str(e)}")
        
        connector_data = response.json()
        results = connector_data.get("results", [])
    
    # 2. Verarbeitung (entspricht Main_GET_ALL_FROM_SW)
    if not results or len(results) == 0:
        return {
            "success": False,
            "error": "Keine Daten von SOLIDWORKS-Connector erhalten"
        }

    # results can be either:
    # - row-major: List[List[Any]] where each row has ~14 fields
    # - column-major legacy: List[List[Any]] with 14 columns -> transpose
    rows = results
    if isinstance(results, list) and len(results) == 14 and all(isinstance(col, list) for col in results):
        # transpose columns -> rows
        try:
            rows = [list(r) for r in zip(*results)]
        except Exception:
            rows = results

    # Clear existing articles for this project to make import idempotent
    try:
        db.query(Article).filter(Article.project_id == project_id).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        logger.error(f"Failed clearing old articles for project {project_id}: {e}", exc_info=True)
        db.rollback()

    # Aggregate parts by (filepath, configuration)
    aggregated = {}
    props_by_key = defaultdict(dict)  # key -> {propName: propValue}

    def _norm_prop_name(name: str) -> str:
        return (name or "").strip().lower().replace(" ", "_")

    def _m_to_mm_int(val):
        """SOLIDWORKS liefert Dimensionen typischerweise in Metern -> mm, ohne Nachkommastellen."""
        if isinstance(val, (int, float)):
            return int(round(float(val) * 1000.0))
        return None

    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 14:
            continue

        pos = row[0]
        partname = row[1]
        config = row[2]
        prop_name = row[4]
        prop_value = row[5]
        x_dim = row[7]
        y_dim = row[8]
        z_dim = row[9]
        weight = row[10]
        part_path = row[11]
        drawing_path = row[12]
        exclude_flag = row[13]

        key = (str(part_path or ""), str(config or ""))
        if not key[0]:
            continue

        # property rows
        if prop_name:
            props_by_key[key][_norm_prop_name(str(prop_name))] = "" if prop_value is None else str(prop_value)
            continue

        # main part row
        if key not in aggregated:
            filename = os.path.splitext(os.path.basename(key[0]))[0] if key[0] else ""
            x_mm = _m_to_mm_int(x_dim)
            y_mm = _m_to_mm_int(y_dim)
            z_mm = _m_to_mm_int(z_dim)

            # #region agent log
            try:
                with open(_debug_log_path, "a", encoding="utf-8") as _f:
                    import time, json
                    _f.write(json.dumps({
                        "timestamp": int(time.time() * 1000),
                        "location": "backend/app/services/solidworks_service.py:dimension_convert",
                        "message": "Converted dimensions m->mm (rounded int)",
                        "data": {
                            "part_path": key[0],
                            "raw_m": {"x": x_dim, "y": y_dim, "z": z_dim},
                            "mm": {"x": x_mm, "y": y_mm, "z": z_mm},
                            "raw_weight": weight
                        },
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "U2"
                    }) + "\n")
            except Exception:
                pass
            # #endregion

            aggregated[key] = {
                "pos_nr": int(pos) if isinstance(pos, (int, float)) else None,
                "benennung": str(partname) if partname is not None else filename,
                "konfiguration": str(config) if config is not None else "",
                "teilenummer": filename,
                "menge": 1,
                # store/display in mm (integer values, but DB column is Float)
                "laenge": float(x_mm) if x_mm is not None else None,
                "breite": float(y_mm) if y_mm is not None else None,
                "hoehe": float(z_mm) if z_mm is not None else None,
                # weight expected in kg from connector; keep as-is (float)
                "gewicht": float(weight) if isinstance(weight, (int, float)) else None,
                "pfad": os.path.dirname(key[0]) if key[0] else None,
                "sldasm_sldprt_pfad": key[0],
                "slddrw_pfad": str(drawing_path) if drawing_path else None,
                "in_stueckliste_anzeigen": False if exclude_flag else True,
            }
        else:
            aggregated[key]["menge"] += 1

    # Map a few common custom properties into editable fields if present
    prop_to_field = {
        "werkstoff": "werkstoff",
        "werkstoff_nr": "werkstoff_nr",
        "oberflaeche": "oberflaeche",
        "oberflächenschutz": "oberflaechenschutz",
        "oberflaechenschutz": "oberflaechenschutz",
        "farbe": "farbe",
        "lieferzeit": "lieferzeit",
        "abteilung_lieferant": "abteilung_lieferant",
        "teiletyp_fertigungsplan": "teiletyp_fertigungsplan",
        "hg_artikelnummer": "hg_artikelnummer",
    }

    created_articles = []
    for key, data in aggregated.items():
        for prop_name, field in prop_to_field.items():
            if prop_name in props_by_key.get(key, {}):
                data[field] = props_by_key[key][prop_name]

        article = Article(project_id=project_id, **data)
        db.add(article)
        created_articles.append(article)

    db.commit()
    # #region agent log
    try:
        with open(_debug_log_path, "a", encoding="utf-8") as _f:
            import time, json
            _f.write(json.dumps({
                "timestamp": int(time.time() * 1000),
                "location": "backend/app/services/solidworks_service.py:import_solidworks_assembly",
                "message": "EXIT import_solidworks_assembly committed",
                "data": {"created": len(created_articles), "aggregated": len(aggregated), "rows": len(rows)},
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "U3"
            }) + "\n")
    except Exception:
        pass
    # #endregion
    return {
        "success": True,
        "imported_count": len(created_articles),
        "total_parts_count": len(rows),
        "aggregated_count": len(aggregated),
    }
