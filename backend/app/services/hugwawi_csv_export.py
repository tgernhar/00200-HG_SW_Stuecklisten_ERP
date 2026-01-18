"""
HUGWAWI Artikel-Import CSV Export

Erzeugt eine CSV im von HUGWAWI erwarteten Semikolon-Format (inkl. trailing ';' am Zeilenende),
basierend auf Artikel-Daten aus der App-DB.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional, Sequence


HUGWAWI_DEPARTMENTS: Sequence[str] = (
    "02 Blechabteilung",
    "03 Auswärtsfertigung",
    "05 Fräsabteilung",
    "06 Sondermaschinenbau",
    "08 Rohrformenbau",
    "09 Rohrbiegeartikel",
    "01 Konstruktion",
    "07 3D_Druck",
    "10 Verwaltung",
)

DEFAULT_DEPARTMENT_NAME = "03 Auswärtsfertigung"


CSV_HEADER_FIELDS: List[str] = [
    "Artikelnummer",
    "Bezeichnung",
    "Index",
    "Warengruppe",
    "Kunde",
    "Einkaufseinheit",
    "Verkaufseinheit",
    "EK VPE",
    "VK VPE",
    "EK-Datum",
    "EK-Menge",
    "Abteilung",
    "VK Berechnung",
    "Teilenummer",
    "DIN",
    "EN",
    "ISO",
    "EN-ISO",
    "Ursprungsland",
    "Statistische Warennummer",
    "Verschnittfaktor",
    "Verkaufsfaktor",
    "customtext1",
    "customtext2",
    "customtext3",
    "customtext4",
    "customtext5",
    "customtext6",
    "customtext7",
    "customtext8",
    "customtext9",
    "customtext10",
    "customtext11",
    "customtext12",
    "customtext13",
    "customtext14",
    "customtext15",
    "customfloat1",
    "customfloat2",
    "customfloat3",
    "customfloat4",
    "customfloat5",
    "customfloat6",
    "customfloat7",
    "customfloat8",
    "customfloat9",
    "customfloat10",
    "customdate1",
    "customdate2",
    "customdate3",
    "customdate4",
    "customdate5",
    "customint1",
    "customint2",
    "customint3",
    "customint4",
    "customint5",
    "customint6",
    "customboolean1",
    "customboolean2",
    "customboolean3",
    "customboolean4",
    "customboolean5",
    "customboolean6",
    "Gewicht",
]


def _csv_escape(value: str) -> str:
    """
    Minimales CSV-Escaping (Semikolon-separiert).
    Wir quoten nur, wenn nötig (Semikolon/Zeilenumbruch/Quote).
    """
    if value is None:
        return ""
    s = str(value)
    if any(ch in s for ch in (';', '\n', '\r', '"')):
        s = s.replace('"', '""')
        return f'"{s}"'
    return s


def format_float_dot(v: Optional[float]) -> str:
    if v is None:
        return ""
    try:
        # Keep decimal point. Avoid scientific notation for typical values.
        s = f"{float(v):.10f}".rstrip("0").rstrip(".")
        return s
    except Exception:
        return ""


def compute_warengruppe(hg_artikelnummer: str) -> str:
    s = (hg_artikelnummer or "").strip()
    return s[:6] if len(s) >= 6 else ""


def compute_kunde_from_rules(hg_artikelnummer: str) -> str:
    """
    Umsetzung der beschriebenen Regeln für 'Kunde' (KID):

    - Warengruppe beginnt mit '9'  -> letzte 5 Zeichen der Warengruppe (6-stellig).
    - Warengruppe beginnt mit '09' -> die nächsten 3 Zeichen nach '09' (also warengruppe[2:5]).
    - Warengruppe ist '099880'     -> 4 Zeichen ab Position 8 der Artikelnummer nach dem '-' (1-based),
                                     d.h. take = part_after_dash[7:11] (0-based).

    Falls etwas nicht passt: leer.
    """
    an = (hg_artikelnummer or "").strip()
    wg = compute_warengruppe(an)
    if not wg:
        return ""

    if wg == "099880":
        # take substring after first '-'
        if "-" not in an:
            return ""
        after = an.split("-", 1)[1]
        if len(after) < 11:
            return ""
        return after[7:11]

    if wg.startswith("09") and len(wg) >= 5:
        return wg[2:5]

    if wg.startswith("9") and len(wg) >= 5:
        return wg[-5:]

    return ""


def normalize_department_name(value: Optional[str]) -> str:
    v = (value or "").strip()
    if not v:
        return DEFAULT_DEPARTMENT_NAME

    allowed = {d.strip(): d for d in HUGWAWI_DEPARTMENTS}
    if v in allowed:
        return allowed[v]

    # toleranter Match (case-insensitive)
    lower_map = {d.lower(): d for d in HUGWAWI_DEPARTMENTS}
    if v.lower() in lower_map:
        return lower_map[v.lower()]

    return DEFAULT_DEPARTMENT_NAME


@dataclass(frozen=True)
class HugwawiCsvRow:
    values: List[str]


def build_hugwawi_article_import_csv(articles: Iterable[object], export_dt: Optional[datetime] = None) -> str:
    """
    Erwartet Objekte mit Attributen wie aus `app.models.article.Article`.
    Gibt CSV als Text (UTF-8 geeignet) zurück, inkl. trailing ';' pro Zeile.
    """
    export_dt = export_dt or datetime.now()
    export_date_str = export_dt.strftime("%d.%m.%Y")

    lines: List[str] = []
    header = ";".join(CSV_HEADER_FIELDS) + ";"  # trailing ';'
    lines.append(header)

    for a in articles:
        hg_artikelnummer = (getattr(a, "hg_artikelnummer", None) or "").strip()
        benennung = getattr(a, "benennung", None) or ""
        konfiguration = getattr(a, "konfiguration", None) or ""
        teilenummer = getattr(a, "teilenummer", None) or ""
        p_menge = getattr(a, "p_menge", None)
        menge = getattr(a, "menge", None)
        abteilung_lieferant = getattr(a, "abteilung_lieferant", None)
        werkstoff = getattr(a, "werkstoff", None) or ""
        werkstoff_nr = getattr(a, "werkstoff_nr", None) or ""
        oberflaeche = getattr(a, "oberflaeche", None) or ""
        farbe = getattr(a, "farbe", None) or ""
        oberflaechenschutz = getattr(a, "oberflaechenschutz", None) or ""
        lieferzeit = getattr(a, "lieferzeit", None) or ""
        pfad = getattr(a, "pfad", None) or ""
        laenge = getattr(a, "laenge", None)
        breite = getattr(a, "breite", None)
        hoehe = getattr(a, "hoehe", None)
        gewicht = getattr(a, "gewicht", None)

        warengruppe = compute_warengruppe(hg_artikelnummer)
        kunde = compute_kunde_from_rules(hg_artikelnummer)
        abteilung = normalize_department_name(abteilung_lieferant)

        ekmenge_val = p_menge if p_menge is not None else menge
        ekmenge_str = "" if ekmenge_val is None else str(int(ekmenge_val))

        # Konstanten gemäß Vorgabe/Referenz
        einheit = "Stück (stck)"
        ek_vpe = "1.0"
        vk_vpe = "1.0"
        verschnittfaktor = "1.0"
        verkaufsfaktor = "1.3"
        vk_berechnung = "VK_Stueck"

        # Reihenfolge muss exakt dem Header entsprechen
        row_values: List[str] = [
            hg_artikelnummer,  # Artikelnummer
            str(benennung),  # Bezeichnung
            str(konfiguration) if konfiguration else "",  # Index
            warengruppe,  # Warengruppe
            kunde,  # Kunde
            einheit,  # Einkaufseinheit
            einheit,  # Verkaufseinheit
            ek_vpe,  # EK VPE
            vk_vpe,  # VK VPE
            export_date_str,  # EK-Datum
            ekmenge_str,  # EK-Menge
            abteilung,  # Abteilung
            vk_berechnung,  # VK Berechnung
            str(teilenummer),  # Teilenummer
            "",  # DIN (leer, nicht NULL)
            "",  # EN
            "",  # ISO
            "",  # EN-ISO
            "",  # Ursprungsland
            "",  # Statistische Warennummer
            verschnittfaktor,  # Verschnittfaktor
            verkaufsfaktor,  # Verkaufsfaktor
            str(werkstoff),  # customtext1
            str(werkstoff_nr),  # customtext2
            str(oberflaeche),  # customtext3
            str(farbe),  # customtext4
            str(oberflaechenschutz),  # customtext5
            str(lieferzeit),  # customtext6
            str(pfad),  # customtext7
            "",  # customtext8
            "",  # customtext9
            "",  # customtext10
            "",  # customtext11
            "",  # customtext12
            "",  # customtext13
            "",  # customtext14
            "",  # customtext15
            format_float_dot(laenge),  # customfloat1
            format_float_dot(breite),  # customfloat2
            format_float_dot(hoehe),  # customfloat3
            "",  # customfloat4
            "",  # customfloat5
            "",  # customfloat6
            "",  # customfloat7
            "",  # customfloat8
            "",  # customfloat9
            "",  # customfloat10
            "",  # customdate1
            "",  # customdate2
            "",  # customdate3
            "",  # customdate4
            "",  # customdate5
            "",  # customint1
            "",  # customint2
            "",  # customint3
            "",  # customint4
            "",  # customint5
            "",  # customint6
            "",  # customboolean1
            "",  # customboolean2
            "",  # customboolean3
            "",  # customboolean4
            "",  # customboolean5
            "",  # customboolean6
            format_float_dot(gewicht),  # Gewicht
        ]

        if len(row_values) != len(CSV_HEADER_FIELDS):
            raise RuntimeError(
                f"CSV Row length mismatch: {len(row_values)} values vs {len(CSV_HEADER_FIELDS)} header fields"
            )

        line = ";".join(_csv_escape(v) for v in row_values) + ";"  # trailing ';'
        lines.append(line)

    return "\n".join(lines) + "\n"

