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
import ntpath
import re
import time
import json
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)
# Stelle sicher, dass der Logger die Handler vom Root-Logger erbt
logger.propagate = True
logger.setLevel(logging.DEBUG)  # Setze Level, damit alle Meldungen durchkommen

def _basename_noext_any(p: str) -> str:
    p = p or ""
    # Windows drive path like C:\... or G:\... (works on Linux too)
    if ntpath.splitdrive(p)[0]:
        return ntpath.splitext(ntpath.basename(p))[0]
    # Fallback: try POSIX style
    return os.path.splitext(os.path.basename(p))[0]

def _dirname_any(p: str) -> str:
    p = p or ""
    if ntpath.splitdrive(p)[0]:
        return ntpath.dirname(p)
    return os.path.dirname(p)

def _norm_prop_name(name: str) -> str:
    """
    Normalisierung an VBA/Realwelt angepasst:
    - Umlaute -> ae/oe/ue/ss
    - Sonderzeichen (+, -, Leerzeichen, /, etc.) -> _
    - lower + underscore-collapsing
    """
    s = (name or "").strip()
    s = (
        s.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
        .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
        .replace("ß", "ss")
    )
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


async def import_solidworks_assembly(
    project_id: int,
    bom_id: int,
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

    # Clear existing articles for this BOM to make import idempotent
    try:
        db.query(Article).filter(Article.bom_id == bom_id).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        logger.error(f"Failed clearing old articles for bom {bom_id} (project {project_id}): {e}", exc_info=True)
        db.rollback()

    # Aggregate parts by (filepath, configuration)
    aggregated = {}
    props_by_key = defaultdict(dict)  # key -> {propName: propValue}
    virtual_count = 0

    # NOTE: _norm_prop_name ist oben definiert (VBA-kompatibler)

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
        if str(key[0]).lower().startswith("virtual:"):
            virtual_count += 1

        # property rows
        if prop_name:
            prop_norm = _norm_prop_name(str(prop_name))
            props_by_key[key][prop_norm] = "" if prop_value is None else str(prop_value)
            continue

        # main part row
        if key not in aggregated:
            filename = _basename_noext_any(key[0]) if key[0] else ""
            x_mm = _m_to_mm_int(x_dim)
            y_mm = _m_to_mm_int(y_dim)
            z_mm = _m_to_mm_int(z_dim)

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
                "pfad": _dirname_any(key[0]) if key[0] else None,
                "sldasm_sldprt_pfad": key[0],
                "slddrw_pfad": str(drawing_path) if drawing_path else None,
                # Herkunftsflag: alles was aus dem SOLIDWORKS Import kommt
                "sw_origin": True,
                "in_stueckliste_anzeigen": False if exclude_flag else True,
            }
        else:
            aggregated[key]["menge"] += 1

    def _norm_win_path(p: str) -> str:
        """
        Normalize Windows-ish paths for robust comparisons:
        - backslashes
        - ntpath.normpath
        - lower-case (case-insensitive FS)
        """
        s = (p or "").strip()
        if not s:
            return ""
        try:
            s = s.replace("/", "\\")
            s = ntpath.normpath(s)
        except Exception:
            pass
        return s.lower()

    # Re-number positions after dedupe:
    # - Root assembly row (assembly_filepath) shall be pos_nr = 0
    # - Other rows: sort by original pos and assign contiguous 1..n
    def _pos_sort_key(item):
        _k, _d = item
        p = _d.get("pos_nr")
        try:
            p_int = int(p) if p is not None else None
        except Exception:
            p_int = None
        return (p_int is None, p_int if p_int is not None else 0, str(_d.get("teilenummer") or ""), str(_d.get("benennung") or ""))

    asm_norm = _norm_win_path(assembly_filepath)
    root_item = None
    other_items = []
    for k, d in aggregated.items():
        part_norm = _norm_win_path(k[0])
        if asm_norm and part_norm == asm_norm and root_item is None:
            root_item = (k, d)
        else:
            other_items.append((k, d))

    other_items_sorted = sorted(other_items, key=_pos_sort_key)

    combined = []
    if root_item is not None:
        combined.append(root_item)
    combined.extend(other_items_sorted)

    # Rebuild dict with deterministic order (root first)
    aggregated = {k: v for k, v in combined}

    # Assign pos_nr
    if root_item is not None:
        _rk, _rd = root_item
        _rd["pos_nr"] = 0
        # Root assembly must be a single line item
        _rd["menge"] = 1
        _rd["p_menge"] = 1

    for i, (k, d) in enumerate(other_items_sorted, start=1):
        d["pos_nr"] = i
        # Initialize/Reset Produktionsmenge (P-Menge) from SOLIDWORKS-Menge on every import
        d["p_menge"] = int(d.get("menge") or 0)

    from app.services.solidworks_property_mapping import SW_PROP_NORMALIZED_TO_FIELD as prop_to_field

    created_articles = []
    for key, data in aggregated.items():
        for prop_name, field in prop_to_field.items():
            if prop_name in props_by_key.get(key, {}):
                data[field] = props_by_key[key][prop_name]

        article = Article(project_id=project_id, bom_id=bom_id, **data)
        db.add(article)
        created_articles.append(article)

    db.commit()
    if virtual_count:
        logger.info(f"Imported {virtual_count} VIRTUAL components (toolbox/virtual parts without file paths).")
    return {
        "success": True,
        "imported_count": len(created_articles),
        "total_parts_count": len(rows),
        "aggregated_count": len(aggregated),
    }
