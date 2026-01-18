"""
Zentrales Mapping zwischen SOLIDWORKS Custom Properties und DB-Feldern.

Ziel:
- Import: normalisierte SOLIDWORKS-Property-Namen -> DB-Feld
- Push: DB-Feld -> SOLIDWORKS-Property-Name (inkl. Sonderregel Oberfläche bei .SLDASM)

Wichtig:
- Dieses Mapping ist die Single-Source-of-Truth, damit Import und Zurückschreiben
  immer dieselben Felder abdecken.
"""

from __future__ import annotations

from typing import Dict, Optional


# --- Import mapping (normalized SW prop name -> DB field) ---
# Normalisierung siehe `solidworks_service.normalize_prop_name` (keine Umlaute, Sonderzeichen -> _).
SW_PROP_NORMALIZED_TO_FIELD: Dict[str, str] = {
    # VBA: "H+G Artikelnummer"
    "h_g_artikelnummer": "hg_artikelnummer",
    # Variante ohne Leerzeichen: "H+GArtikelnummer"
    "h_gartikelnummer": "hg_artikelnummer",
    "hg_artikelnummer": "hg_artikelnummer",
    # VBA: "Teilenummer" (überschreibt filename-basierte Teilenummer)
    "teilenummer": "teilenummer",
    # VBA: "Material"
    "material": "werkstoff",
    "werkstoff": "werkstoff",
    # VBA: "HUGWAWI - Abteilung"
    "hugwawi_abteilung": "abteilung_lieferant",
    "abteilung_lieferant": "abteilung_lieferant",
    # VBA: "Werkstoffgruppe"
    "werkstoffgruppe": "werkstoff_nr",
    "werkstoff_nr": "werkstoff_nr",
    # VBA: "Oberfläche_ZSB" / "Oberfläche"
    "oberflaeche_zsb": "oberflaeche",
    "oberflaeche": "oberflaeche",
    "oberflaeche_zsb_": "oberflaeche",
    # VBA: "Oberflächenschutz"
    "oberflaechenschutz": "oberflaechenschutz",
    # VBA: "Farbe"
    "farbe": "farbe",
    # VBA: "Lieferzeit" / "Lieferzeit - geschätzt"
    "lieferzeit": "lieferzeit",
    "lieferzeit_geschaetzt": "lieferzeit",
    # Optional/Legacy
    "teiletyp_fertigungsplan": "teiletyp_fertigungsplan",
}


# --- Push mapping (DB field -> SW prop name) ---
# Für Oberflächen gibt es eine Sonderregel: .SLDASM -> Oberfläche_ZSB, .SLDPRT -> Oberfläche.
FIELD_TO_SW_PROP_COMMON: Dict[str, str] = {
    "hg_artikelnummer": "H+G Artikelnummer",
    "teilenummer": "Teilenummer",
    "werkstoff": "Material",
    "werkstoff_nr": "Werkstoffgruppe",
    "abteilung_lieferant": "HUGWAWI - Abteilung",
    "oberflaechenschutz": "Oberflächenschutz",
    "farbe": "Farbe",
    "lieferzeit": "Lieferzeit - geschätzt",
    "teiletyp_fertigungsplan": "Teiletyp Fertigungsplan",
}


def get_sw_prop_name_for_field(field: str, is_sldasm: bool) -> Optional[str]:
    """Returns the SOLIDWORKS property name for a given DB field (or None if not a SW custom field)."""
    if not field:
        return None
    if field == "oberflaeche":
        return "Oberfläche_ZSB" if is_sldasm else "Oberfläche"
    return FIELD_TO_SW_PROP_COMMON.get(field)

