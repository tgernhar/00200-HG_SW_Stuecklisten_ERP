"""
SOLIDWORKS Connector - Main Module
"""
import win32com.client
import os
from typing import List, Dict, Any, Optional
import logging
import threading
import pythoncom
import time
import getpass
import pywintypes
import ctypes
import winerror
import win32event
import win32con
# (duplicate typing import removed above)

# Logger für SOLIDWORKS-Connector
connector_logger = logging.getLogger('solidworks_connector')

# NOTE: previously used for debug-mode ingest; kept as no-op to avoid churn.
def _agent_log(*args, **kwargs):
    return

def _basename_noext_any(path: str) -> str:
    try:
        base = os.path.basename(path or "")
        return os.path.splitext(base)[0]
    except Exception:
        return ""

# Tracks whether this process started SOLIDWORKS via Dispatch (not an existing instance).
_started_by_connector = False


class SolidWorksConnectorV2:
    """SOLIDWORKS Connector für COM API Zugriff"""
    
    def __init__(self):
        self.sw_app = None
        # Track which thread created the COM object (COM objects must stay on the same thread)
        self._owner_thread_id: int | None = None
        self._com_initialized: bool = False
        self._owns_app: bool = False
    
    def connect(self):
        """Verbindung zu SOLIDWORKS herstellen"""
        try:
            # COM initialization is required in the current thread before any win32com calls.
            # Runtime evidence: (-2147221008, 'CoInitialize wurde nicht aufgerufen.')
            try:
                pythoncom.CoInitialize()
                self._com_initialized = True
            except Exception as ci_err:
                connector_logger.error(f"CoInitialize failed: {ci_err}", exc_info=True)

            self._owner_thread_id = threading.get_ident()
            connector_logger.info(f"Thread ident: {self._owner_thread_id} PID: {os.getpid()} USER: {getpass.getuser()}")
            # Session-ID ist wichtig (SOLIDWORKS läuft typischerweise in interaktiver User-Session, nicht Session 0)
            try:
                session_id = ctypes.c_uint()
                ctypes.windll.kernel32.ProcessIdToSessionId(os.getpid(), ctypes.byref(session_id))
                try:
                    active_console = ctypes.windll.kernel32.WTSGetActiveConsoleSessionId()
                except Exception:
                    active_console = None
                connector_logger.info(f"SessionId: {session_id.value} ActiveConsoleSessionId: {active_console}")
                if session_id.value == 0:
                    msg = (
                        "SOLIDWORKS-Connector läuft in Session 0 (Windows-Service). "
                        "SOLIDWORKS COM ist in der Regel nur in der interaktiven User-Session verfügbar. "
                        "Lösung: Service stoppen und Connector als User-Prozess starten (oder Scheduled Task: "
                        "'Nur ausführen, wenn Benutzer angemeldet ist')."
                    )
                    connector_logger.error(msg)
                    raise Exception(msg)
            except Exception as sid_err:
                connector_logger.error(f"Could not get session information: {sid_err}", exc_info=True)

            connector_logger.info("Versuche Verbindung zu SOLIDWORKS herzustellen...")
            # Hard guard: multiple SOLIDWORKS processes cause COM ambiguity and can lead to
            # "bereits geöffnet / Kopie öffnen?" prompts.
            allow_multi = str(os.getenv("SWC_ALLOW_MULTI_INSTANCE", "0")).strip().lower() in ("1", "true", "yes")
            connect_mode = None
            try:
                # Use the existing interactive SOLIDWORKS instance if present.
                self.sw_app = win32com.client.GetActiveObject("SldWorks.Application")
                connect_mode = "active"
            except Exception:
                try:
                    self.sw_app = win32com.client.Dispatch("SldWorks.Application")
                    connect_mode = "dispatch"
                except Exception:
                    connect_mode = "failed"
                    raise
            self._owns_app = connect_mode == "dispatch"
            if self._owns_app:
                try:
                    global _started_by_connector
                    _started_by_connector = True
                except Exception:
                    pass
            if self._owns_app:
                try:
                    # Run SOLIDWORKS headless when we started it.
                    self.sw_app.Visible = False
                except Exception:
                    pass


            # Do not force-hide user's instance.
            connector_logger.info("Erfolgreich zu SOLIDWORKS verbunden")
            return True
        except pywintypes.com_error as e:
            connector_logger.error(f"COM Fehler beim Verbinden zu SOLIDWORKS: {e}", exc_info=True)
            return False
        except Exception as e:
            connector_logger.error(f"Fehler beim Verbinden zu SOLIDWORKS: {e}", exc_info=True)
            return False
    
    def disconnect(self):
        """Verbindung zu SOLIDWORKS trennen"""
        try:
            import json
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "sw-activity",
                    "hypothesisId": "SW_LIFECYCLE",
                    "location": "solidworks-connector/src/SolidWorksConnector.py:disconnect",
                    "message": "disconnect",
                    "data": {"had_app": self.sw_app is not None},
                    "timestamp": int(time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        if self.sw_app:
            self.sw_app = None

    def _shutdown_if_owned(self, reason: str) -> None:
        if not self.sw_app or not self._owns_app:
            return
        try:
            import json, time
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "sw-activity",
                    "hypothesisId": "SW_LIFECYCLE",
                    "location": "solidworks-connector/src/SolidWorksConnector.py:_shutdown_if_owned",
                    "message": "pre_shutdown",
                    "data": {"reason": reason, "open_doc_count": self.get_open_doc_count()},
                    "timestamp": int(time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        try:
            # Best effort: close all docs without save prompts.
            try:
                self.sw_app.CloseAllDocuments(False)
            except Exception:
                try:
                    self.sw_app.CloseAllDocuments()
                except Exception:
                    pass
            try:
                self.sw_app.ExitApp()
            except Exception:
                pass
        finally:
            self.sw_app = None
            self._owns_app = False
        try:
            import json, time
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "sw-activity",
                    "hypothesisId": "SW_LIFECYCLE",
                    "location": "solidworks-connector/src/SolidWorksConnector.py:_shutdown_if_owned",
                    "message": "post_shutdown",
                    "data": {"reason": reason},
                    "timestamp": int(time.time() * 1000),
                }) + "\n")
        except Exception:
            pass

    def can_close_app(self) -> bool:
        try:
            return bool(_started_by_connector)
        except Exception:
            return False

    def close_app(self, reason: str) -> bool:
        if not self.can_close_app():
            return False
        try:
            if not self.sw_app:
                self.connect()
        except Exception:
            pass
        if not self.sw_app:
            return False
        try:
            self._shutdown_if_owned(reason)
            return True
        finally:
            try:
                global _started_by_connector
                _started_by_connector = False
            except Exception:
                pass

    def get_open_doc_count(self) -> int | None:
        try:
            if not self.sw_app:
                return None
            count = getattr(self.sw_app, "GetDocumentCount", None)
            count = count() if callable(count) else count
            return int(count) if count is not None else None
        except Exception:
            return None
        # We intentionally do NOT call CoUninitialize here:
        # - Request threads may be reused by the server.
        # - Uninitializing COM while objects are still referenced can cause undefined behavior.
        # If needed, we can revisit with a dedicated COM thread model.

    def _close_doc_best_effort(self, model, filepath: str) -> None:
        """
        SOLIDWORKS CloseDoc ist in vielen Umgebungen am zuverlässigsten mit Dokumenttitel (nicht vollem Pfad).
        Wir versuchen daher: Titel -> Basename -> Pfad. Best effort: niemals Exception nach außen werfen.
        """
        try:
            def _get_str_member(obj, name: str) -> Optional[str]:
                try:
                    v = getattr(obj, name, None)
                except Exception:
                    return None
                try:
                    v2 = v() if callable(v) else v
                except Exception:
                    v2 = v
                if v2 is None:
                    return None
                s = str(v2).strip()
                return s or None

            title = _get_str_member(model, "GetTitle") or _get_str_member(model, "Title")
            basename = os.path.basename(filepath) if filepath else None
            candidates = [c for c in [basename, title, filepath] if c]

            _agent_log(
                "C",
                "SolidWorksConnector.py:_close_doc_best_effort",
                "close_candidates",
                {"filepath": filepath, "title": title, "basename": basename, "candidates": candidates},
            )

            closed_with = None
            for cand in candidates:
                try:
                    _agent_log(
                        "C",
                        "SolidWorksConnector.py:_close_doc_best_effort",
                        "close_attempt",
                        {"cand": cand},
                    )
                    self.sw_app.CloseDoc(cand)
                    closed_with = cand
                    _agent_log(
                        "C",
                        "SolidWorksConnector.py:_close_doc_best_effort",
                        "close_attempt_done",
                        {"cand": cand},
                    )
                    break
                except Exception:
                    continue

            # Post-check: SOLIDWORKS API often expects FULL PATH for GetOpenDocumentByName.
            still_open_by_title = None
            still_open_by_path = None
            try:
                if title:
                    still_open_by_title = bool(self.sw_app.GetOpenDocumentByName(title))
            except Exception:
                still_open_by_title = None
            try:
                if filepath:
                    still_open_by_path = bool(self.sw_app.GetOpenDocumentByName(filepath))
            except Exception:
                still_open_by_path = None

            # If still open, try one more time with remaining candidates (best effort).
            if (still_open_by_title is True) or (still_open_by_path is True):
                for cand in candidates:
                    if cand == closed_with:
                        continue
                    try:
                        self.sw_app.CloseDoc(cand)
                    except Exception:
                        pass
                try:
                    if title:
                        still_open_by_title = bool(self.sw_app.GetOpenDocumentByName(title))
                except Exception:
                    pass
                try:
                    if filepath:
                        still_open_by_path = bool(self.sw_app.GetOpenDocumentByName(filepath))
                except Exception:
                    pass
        except Exception:
            try:
                if filepath:
                    self.sw_app.CloseDoc(filepath)
            except Exception:
                pass

    def _wait_for_file(
        self,
        primary_path: str,
        alt_paths: list[str] | None = None,
        timeout_s: float = 12.0,
        step_ms: int = 75,
        location: str = "SolidWorksConnector.py:_wait_for_file",
    ) -> tuple[bool, str | None]:
        """
        Wartet ereignisbasiert bis eine Datei existiert (und Größe > 0 hat).
        Hintergrund: SaveAs2 kann "ok=true" liefern, obwohl das Schreiben erst später fertig wird.
        """
        alts = [p for p in (alt_paths or []) if p]
        candidates = [primary_path] + [p for p in alts if p != primary_path]
        deadline = time.monotonic() + float(timeout_s)
        _agent_log("C", location, "wait_for_file_start", {"candidates": candidates[:6], "timeout_s": timeout_s})
        while time.monotonic() < deadline:
            for p in candidates:
                try:
                    if os.path.exists(p) and os.path.getsize(p) > 0:
                        _agent_log("C", location, "wait_for_file_ok", {"path": p})
                        return True, p
                except Exception:
                    continue
            try:
                pythoncom.PumpWaitingMessages()
            except Exception:
                pass
            try:
                win32event.MsgWaitForMultipleObjects([], False, step_ms, win32con.QS_ALLEVENTS)
            except Exception:
                pass
        _agent_log("C", location, "wait_for_file_timeout", {"primary": primary_path})
        return False, None
    
    def get_all_parts_and_properties_from_assembly(self, assembly_filepath: str) -> List[List[Any]]:
        """
        Liest alle Teile und Properties aus SOLIDWORKS-Assembly
        
        Entspricht VBA Main_Get_All_Parts_and_Properties_From_Assembly()
        
        Returns:
            2D-Array mit Struktur:
            - results[0][j] = Child/Position
            - results[1][j] = Partname
            - results[2][j] = Configuration
            - results[4][i] = Property Name
            - results[5][i] = Property Value
            - results[7][j] = X-Dimension
            - results[8][j] = Y-Dimension
            - results[9][j] = Z-Dimension
            - results[10][j] = Gewicht
            - results[11][j] = Filepath Part/ASM
            - results[12][j] = Filepath Drawing
            - results[13][j] = Exclude from Boom Flag
        """
        connector_logger.info(f"get_all_parts_and_properties_from_assembly aufgerufen mit: {assembly_filepath}")
        # (debug instrumentation removed)

        # Robustness: callers sometimes pass a directory instead of a .SLDASM file.
        # In that case, try to auto-pick a single .SLDASM in that directory.
        if assembly_filepath and os.path.isdir(assembly_filepath):
            try:
                entries = []
                try:
                    entries = os.listdir(assembly_filepath)
                except Exception:
                    entries = []
                sldasm_files = [
                    os.path.join(assembly_filepath, e)
                    for e in entries
                    if isinstance(e, str) and e.lower().endswith(".sldasm")
                ]
                if len(sldasm_files) == 1:
                    assembly_filepath = sldasm_files[0]
                    connector_logger.info(f"Directory given; auto-selected assembly: {assembly_filepath}")
                elif len(sldasm_files) == 0:
                    raise Exception(
                        f"Assembly-Pfad ist ein Ordner, aber keine .SLDASM gefunden: {assembly_filepath}"
                    )
                else:
                    # Prefer a file that matches the directory name, else fail with actionable message.
                    dir_name = os.path.basename(os.path.normpath(assembly_filepath)).lower()
                    preferred = None
                    for fp in sldasm_files:
                        base = os.path.splitext(os.path.basename(fp))[0].lower()
                        if base == dir_name or dir_name in base:
                            preferred = fp
                            break
                    if preferred:
                        assembly_filepath = preferred
                        connector_logger.info(f"Multiple .SLDASM found; auto-selected: {assembly_filepath}")
                    else:
                        raise Exception(
                            "Assembly-Pfad ist ein Ordner mit mehreren .SLDASM. "
                            "Bitte eine konkrete .SLDASM-Datei angeben. "
                            f"Gefunden: {', '.join(os.path.basename(x) for x in sldasm_files[:5])}"
                        )
            except Exception as e:
                raise
        
        if not self.sw_app:
            connector_logger.info("SOLIDWORKS-Verbindung nicht vorhanden, versuche Verbindung...")
            if not self.connect():
                connector_logger.error("Konnte nicht zu SOLIDWORKS verbinden")
                raise Exception("Konnte nicht zu SOLIDWORKS verbinden")
        
        # Defensive: ensure we do not use a COM object from a different thread
        current_tid = threading.get_ident()
        if self._owner_thread_id is not None and self._owner_thread_id != current_tid:
            connector_logger.error(f"COM object thread mismatch: owner={self._owner_thread_id}, current={current_tid}")
            raise Exception("Interner Fehler: SOLIDWORKS COM Objekt wurde in anderem Thread erstellt (Thread-Mismatch)")

        if not os.path.exists(assembly_filepath):
            connector_logger.error(f"Assembly-Datei nicht gefunden: {assembly_filepath}")
            raise Exception(f"Assembly-Datei nicht gefunden: {assembly_filepath}")
        
        connector_logger.info(f"Assembly-Datei gefunden: {assembly_filepath}")
        
        # Öffne Assembly
        # OpenDoc6 signature expects Errors/Warnings as BYREF longs -> passing plain 0 can cause "Typenkonflikt".
        sw_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        sw_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        # SOLIDWORKS swDocumentTypes_e:
        # - swDocPART = 1
        # - swDocASSEMBLY = 2
        # - swDocDRAWING = 3
        try:
            sw_model = self.sw_app.OpenDoc6(
                assembly_filepath,
                2,  # swDocASSEMBLY
                0,  # swOpenDocOptions_Silent
                "",
                sw_errors,
                sw_warnings
            )
        except Exception as e:
            # retry once after reconnect
            try:
                self.connect()
            except Exception:
                pass
            try:
                sw_model = self.sw_app.OpenDoc6(
                    assembly_filepath,
                    2,
                    0,
                    "",
                    sw_errors,
                    sw_warnings
                )
            except Exception as e2:
                raise
        connector_logger.debug(f"OpenDoc6(ASM) errors={sw_errors.value} warnings={sw_warnings.value}")
        
        if not sw_model:
            raise Exception(f"Konnte Assembly nicht öffnen: {assembly_filepath}")

        
        results = []

        def _to_list_safe(x):
            if x is None:
                return []
            try:
                return list(x)
            except Exception:
                return []

        # Custom Properties (global + config) lesen und mergen (Config überschreibt global)
        def _read_custom_properties(model, config_name: str) -> List[Dict[str, str]]:
            properties: List[Dict[str, str]] = []
            try:
                props_by_name: Dict[str, str] = {}
                order: List[str] = []

                def _collect_from_mgr(mgr_name: str):
                    mgr = model.Extension.CustomPropertyManager(mgr_name)
                    getnames = getattr(mgr, "GetNames", None)
                    try:
                        names = getnames() if callable(getnames) else getnames
                    except Exception as _e_getnames:
                        connector_logger.error(f"Fehler bei GetNames ({mgr_name}): {_e_getnames}", exc_info=True)
                        names = []
                    if names is None:
                        names = []
                    try:
                        names_list = list(names)
                    except Exception:
                        names_list = []

                    def _pick_str(x):
                        if x is None:
                            return ""
                        if isinstance(x, bool):
                            return ""
                        if isinstance(x, str):
                            return x
                        if isinstance(x, (list, tuple)):
                            if len(x) == 2 and isinstance(x[1], str):
                                return x[1]
                            for it in x:
                                if isinstance(it, str) and it:
                                    return it
                            return ""
                        return str(x)

                    for pn in names_list:
                        try:
                            val = ""

                            # 1) Get2
                            try:
                                if hasattr(mgr, "Get2"):
                                    try:
                                        raw2 = mgr.Get2(str(pn), "")
                                    except Exception:
                                        raw2 = mgr.Get2(str(pn))
                                    val = _pick_str(raw2)
                            except Exception:
                                val = ""

                            # 2) Get4 (prefer resolved)
                            if not val:
                                try:
                                    if hasattr(mgr, "Get4"):
                                        try:
                                            import pythoncom
                                            import win32com.client
                                            vt_bstr_byref = pythoncom.VT_BSTR | pythoncom.VT_BYREF
                                            v_raw = win32com.client.VARIANT(vt_bstr_byref, "")
                                            v_res = win32com.client.VARIANT(vt_bstr_byref, "")
                                            mgr.Get4(str(pn), False, v_raw, v_res)
                                            val = _pick_str(getattr(v_res, "value", None)) or _pick_str(getattr(v_raw, "value", None))
                                        except Exception:
                                            raw4 = mgr.Get4(str(pn), False, "", "")
                                            val = _pick_str(raw4)
                                except Exception:
                                    val = val

                            # 3) Get5
                            if not val:
                                try:
                                    if hasattr(mgr, "Get5"):
                                        raw5 = mgr.Get5(str(pn), False)
                                        val = _pick_str(raw5)
                                except Exception:
                                    val = val

                            # 4) Get6 (prefer resolved)
                            if not val:
                                try:
                                    if hasattr(mgr, "Get6"):
                                        try:
                                            import pythoncom
                                            import win32com.client
                                            vt_bstr_byref = pythoncom.VT_BSTR | pythoncom.VT_BYREF
                                            vt_bool_byref = pythoncom.VT_BOOL | pythoncom.VT_BYREF
                                            v_raw = win32com.client.VARIANT(vt_bstr_byref, "")
                                            v_res = win32com.client.VARIANT(vt_bstr_byref, "")
                                            v_was = win32com.client.VARIANT(vt_bool_byref, False)
                                            v_link = win32com.client.VARIANT(vt_bstr_byref, "")
                                            mgr.Get6(str(pn), False, v_raw, v_res, v_was, v_link)
                                            val = _pick_str(getattr(v_res, "value", None)) or _pick_str(getattr(v_raw, "value", None))
                                        except Exception:
                                            raw6 = mgr.Get6(str(pn), False, "")
                                            val = _pick_str(raw6)
                                except Exception:
                                    val = val

                            name_str = str(pn)
                            if name_str not in props_by_name:
                                order.append(name_str)
                            props_by_name[name_str] = str(val)
                        except Exception as _e_prop:
                            connector_logger.error(f"Fehler beim Lesen der Property '{pn}' ({mgr_name}): {_e_prop}", exc_info=True)

                # Global zuerst, dann Config überschreibt
                _collect_from_mgr("")
                if config_name:
                    _collect_from_mgr(config_name)

                for name_str in order:
                    properties.append({"name": name_str, "value": props_by_name.get(name_str, "")})
            except Exception as e:
                connector_logger.error(f"Fehler beim Lesen der Properties: {e}", exc_info=True)
            return properties

        # Root-Assembly als Pos 0 aufnehmen (Hauptbaugruppe)
        def _get_str_member(obj, name: str) -> Optional[str]:
            try:
                v = getattr(obj, name, None)
            except Exception:
                return None
            try:
                v2 = v() if callable(v) else v
            except Exception:
                v2 = v
            if v2 is None:
                return None
            s = str(v2).strip()
            return s or None

        root_child = 0
        root_title = _get_str_member(sw_model, "GetTitle") or _get_str_member(sw_model, "Title")
        root_name = root_title or os.path.splitext(os.path.basename(assembly_filepath))[0]
        root_config = ""
        try:
            root_config = str(sw_model.ConfigurationManager.ActiveConfiguration.Name or "")
        except Exception:
            root_config = ""
        root_props = _read_custom_properties(sw_model, root_config)

        # Main row (no prop_name)
        results.append([
            root_child,  # [0] Position/Child
            root_name,  # [1] Partname
            root_config,  # [2] Configuration
            None,  # [3] Reserved
            None,  # [4] Property Name
            None,  # [5] Property Value
            None,  # [6] Reserved
            0,  # [7] X-Dimension (Assembly: nicht relevant)
            0,  # [8] Y-Dimension
            0,  # [9] Z-Dimension
            0.0,  # [10] Gewicht (Assembly: optional; hier 0)
            assembly_filepath,  # [11] Filepath Part/ASM
            "",  # [12] Filepath Drawing (unbekannt)
            0,  # [13] Exclude from Boom
        ])
        # Property rows
        for prop in root_props:
            results.append([
                root_child,
                root_name,
                root_config,
                None,
                prop.get("name"),
                prop.get("value"),
                None,
                0,
                0,
                0,
                0.0,
                assembly_filepath,
                "",
                0,
            ])

        # Komponenten ab 1 zählen (0 ist Root)
        child = 1
        
        try:
            # Traversiere Teilebaum
            asm_doc = sw_model
            try:
                asm_doc = win32com.client.CastTo(sw_model, "AssemblyDoc")
            except Exception:
                asm_doc = sw_model

            # NOTE: SOLIDWORKS API param semantics differ (top-level-only vs all-levels).
            # We must prefer "all levels" to include sub-assemblies and nested parts.
            # We'll still fall back to other variants/root traversal if needed.
            components = []
            raw_components = None
            try:
                # Prefer all levels (TopLevelOnly = False)
                raw_components = getattr(asm_doc, "GetComponents")(False)
                components = _to_list_safe(raw_components)
            except Exception:
                components = []
            if not components:
                try:
                    # Fallback: top-level only (may still be better than empty in some environments)
                    raw_components = getattr(asm_doc, "GetComponents")(True)
                    components = _to_list_safe(raw_components)
                except Exception:
                    components = []

            # If still empty, try resolving lightweight + rebuild and retry.
            if not components:
                try:
                    if hasattr(asm_doc, "ResolveAllLightWeightComponents"):
                        asm_doc.ResolveAllLightWeightComponents(True)
                except Exception:
                    pass
                try:
                    if hasattr(sw_model, "ForceRebuild3"):
                        sw_model.ForceRebuild3(False)
                except Exception:
                    pass
                try:
                    # Retry after resolve/rebuild
                    raw_components = getattr(asm_doc, "GetComponents")(False)
                    components = _to_list_safe(raw_components)
                except Exception:
                    components = []

            # Root-component traversal fallback (robust when GetComponents returns empty)
            # Some environments return a SAFEARRAY with None placeholders (len>0 but all entries None).
            components = [c for c in components if c is not None]
            initial_components_count = len(components)
            if not components:
                try:
                    root = None
                    try:
                        if hasattr(asm_doc, "GetRootComponent3"):
                            root = asm_doc.GetRootComponent3(True)
                    except Exception:
                        root = None
                    if root is None:
                        try:
                            cfg = sw_model.ConfigurationManager.ActiveConfiguration
                            if cfg is not None and hasattr(cfg, "GetRootComponent3"):
                                root = cfg.GetRootComponent3(True)
                        except Exception:
                            root = None

                    def _walk(c):
                        if c is None:
                            return
                        components.append(c)
                        try:
                            kids = getattr(c, "GetChildren", None)
                            kids = kids() if callable(kids) else kids
                        except Exception:
                            kids = None
                        for k in _to_list_safe(kids):
                            _walk(k)

                    if root is not None:
                        _walk(root)
                except Exception:
                    pass

            # Ensure nested components are included even if GetComponents() returned only top-level.
            try:
                seen_ids: set[int] = set()
                all_components: list[Any] = []

                def _walk_children(c):
                    if c is None:
                        return
                    cid = id(c)
                    if cid in seen_ids:
                        return
                    seen_ids.add(cid)
                    all_components.append(c)
                    try:
                        kids = getattr(c, "GetChildren", None)
                        kids = kids() if callable(kids) else kids
                    except Exception:
                        kids = None
                    for k in _to_list_safe(kids):
                        _walk_children(k)

                for c in components:
                    _walk_children(c)
                components = all_components
            except Exception:
                pass


            hidden_count = 0
            missing_path_count = 0
            lightweight_count = 0
            missing_lightweight_count = 0
            missing_has_modeldoc_count = 0
            missing_has_name_count = 0
            asm_loaded_children: list[str] = []
            for component in components:
                # Prüfe ob Teil versteckt ist
                # Some SOLIDWORKS COM properties may appear as either methods or boolean properties via pywin32.
                # Runtime evidence: TypeError: 'bool' object is not callable when calling IsSuppressed().
                def _get_bool_attr(obj, name: str) -> bool:
                    val = getattr(obj, name, False)
                    try:
                        return bool(val()) if callable(val) else bool(val)
                    except Exception:
                        return bool(val)

                # Similarly, some string-returning members may appear as methods or properties.
                # Runtime evidence: TypeError: 'str' object is not callable (e.g. GetPathName).
                def _get_str_attr(obj, name: str) -> str:
                    val = getattr(obj, name, "")
                    try:
                        res = val() if callable(val) else val
                    except Exception:
                        res = val
                    return "" if res is None else str(res)

                is_suppressed = _get_bool_attr(component, "IsSuppressed")
                is_envelope = _get_bool_attr(component, "IsEnvelope")
                is_lightweight = _get_bool_attr(component, "IsLightWeight")
                if is_lightweight:
                    lightweight_count += 1
                is_hidden = is_suppressed or is_envelope

                # WICHTIG (Toolbox/Envelope): Auch versteckte/unterdrückte Komponenten sollen in der Liste landen.
                # Wir setzen dafür nur das Exclude-Flag, skippen aber nicht mehr.
                part_path = _get_str_attr(component, "GetPathName")
                part_name = _get_str_attr(component, "Name2")
                config_name = _get_str_attr(component, "ReferencedConfiguration")

                # Fallback: manche Toolbox/virtuelle Komponenten liefern über Component kein PathName.
                if not part_path:
                    try:
                        md = getattr(component, "GetModelDoc2", None)
                        md = md() if callable(md) else md
                        if md is not None:
                            part_path = _get_str_member(md, "GetPathName") or _get_str_member(md, "PathName") or ""
                    except Exception:
                        part_path = part_path or ""

                if not part_path:
                    missing_path_count += 1
                    if is_lightweight:
                        missing_lightweight_count += 1
                    if part_name:
                        missing_has_name_count += 1
                    try:
                        md = getattr(component, "GetModelDoc2", None)
                        md = md() if callable(md) else md
                    except Exception:
                        md = None
                    if md is not None:
                        missing_has_modeldoc_count += 1
                    # Ohne Pfad (Toolbox/virtuell): versuche einen stabilen Namen zu finden.
                    safe_name = (part_name or "").strip()
                    if not safe_name:
                        try:
                            md = getattr(component, "GetModelDoc2", None)
                            md = md() if callable(md) else md
                        except Exception:
                            md = None
                        if md is not None:
                            safe_name = (
                                _get_str_member(md, "GetTitle")
                                or _get_str_member(md, "Title")
                                or _basename_noext_any(_get_str_member(md, "GetPathName") or _get_str_member(md, "PathName") or "")
                            )
                    safe_name = (safe_name or "").strip()
                    if not safe_name:
                        # Fallback: unique per instance to avoid collapsing all UNKNOWN parts
                        safe_name = f"UNKNOWN:{child}"
                    part_path = f"VIRTUAL:{safe_name}"

                # Track sub-assembly child availability
                if part_path.lower().endswith(".sldasm"):
                    try:
                        kids = getattr(component, "GetChildren", None)
                        kids = kids() if callable(kids) else kids
                    except Exception:
                        kids = None
                    child_list = _to_list_safe(kids)
                    if len(child_list) == 0:
                        # Try to open sub-assembly to load children explicitly
                        try:
                            sub_model = None
                            try:
                                sub_model = self.sw_app.OpenDoc6(
                                    part_path,
                                    2,
                                    0,
                                    "",
                                    part_errors,
                                    part_warnings,
                                )
                            except Exception:
                                sub_model = None
                            if sub_model is not None:
                                try:
                                    sub_asm = win32com.client.CastTo(sub_model, "AssemblyDoc")
                                except Exception:
                                    sub_asm = sub_model
                                try:
                                    sub_components = getattr(sub_asm, "GetComponents")(False)
                                except Exception:
                                    sub_components = []
                                for sc in _to_list_safe(sub_components):
                                    if sc is None:
                                        continue
                                    components.append(sc)
                                asm_loaded_children.append(part_path)
                        except Exception:
                            pass

                # Benennung stabil aus Dateiname (ohne Extension) ableiten, falls möglich.
                display_name = ""
                if part_path and not part_path.lower().startswith("virtual:"):
                    base_name = os.path.basename(part_path)
                    display_name = os.path.splitext(base_name)[0]
                if not display_name:
                    display_name = (part_name or "").strip()
                if not display_name and part_path.lower().startswith("virtual:"):
                    display_name = part_path.split(":", 1)[1].strip()
                if display_name:
                    part_name = display_name

                # Öffne Part/Assembly für Dimensions-/Property-Abfrage (best effort)
                x_dim = 0
                y_dim = 0
                z_dim = 0
                weight = 0.0
                drawing_path = ""
                properties = []

                part_model = None
                part_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                part_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                try:
                    part_model = self.sw_app.OpenDoc6(
                        part_path,
                        1 if part_path.endswith(".SLDPRT") else 2,
                        0,
                        "",
                        part_errors,
                        part_warnings,
                    )
                except Exception:
                    part_model = None

                if part_model:
                    try:
                        # Lese Dimensionen
                        try:
                            # GetPartBox is only valid for PART documents in many SOLIDWORKS type libs.
                            if str(part_path).upper().endswith(".SLDPRT") and hasattr(part_model, "GetPartBox"):
                                box = part_model.GetPartBox(True)
                                x_dim = box[3] - box[0] if box else 0
                                y_dim = box[4] - box[1] if box else 0
                                z_dim = box[5] - box[2] if box else 0
                        except Exception as _e_box:
                            connector_logger.error(f"Fehler bei GetPartBox ({part_path}): {_e_box}", exc_info=True)

                        # Lese Gewicht
                        # Gewicht (kg): SOLIDWORKS COM APIs unterscheiden sich je nach Version/Typelib.
                        # Wir probieren mehrere Varianten und loggen minimal nach NDJSON für Laufzeit-Evidence.
                        weight = 0.0

                        # Versuch 1: IModelDoc2.GetMassProperties2(0)
                        try:
                            mass_props = part_model.GetMassProperties2(0)
                            weight = float(mass_props[0]) if mass_props and len(mass_props) > 0 else 0.0
                        except Exception as e1:
                            connector_logger.error(f"Fehler bei GetMassProperties2: {e1}", exc_info=True)

                        # Versuch 2: IModelDoc2.GetMassProperties2(VARIANT VT_I4=0)
                        if weight == 0.0:
                            try:
                                opt = win32com.client.VARIANT(pythoncom.VT_I4, 0)
                                mass_props = part_model.GetMassProperties2(opt)
                                weight = float(mass_props[0]) if mass_props and len(mass_props) > 0 else 0.0
                            except Exception as e2:
                                connector_logger.error(f"Fehler bei GetMassProperties2(VARIANT): {e2}", exc_info=True)

                        # Versuch 3: IModelDocExtension.GetMassProperties(1) (typischer VBA-Pfad)
                        if weight == 0.0:
                            try:
                                ext = part_model.Extension
                                # Some typelibs require extra parameters (COM says: "Parameter nicht optional")
                                if hasattr(ext, "GetMassProperties"):
                                    mp = None
                                    # First try: VBA-style (1 param)
                                    try:
                                        mp = ext.GetMassProperties(1)
                                    except Exception as _e_one:
                                        # Second try: 2 params (options, status/byref or config placeholder)
                                        mp = ext.GetMassProperties(1, 0)
                                    weight = float(mp[0]) if mp and len(mp) > 0 else 0.0
                            except Exception as e3:
                                connector_logger.error(f"Fehler bei Extension.GetMassProperties: {e3}", exc_info=True)

                        # Versuch 4: IModelDocExtension.GetMassProperties2(0)
                        if weight == 0.0:
                            try:
                                ext = part_model.Extension
                                if hasattr(ext, "GetMassProperties2"):
                                    mp = None
                                    # Try common signatures: (options) or (options, status) or (options, config, status)
                                    try:
                                        mp = ext.GetMassProperties2(0)
                                    except Exception as _e_one:
                                        try:
                                            mp = ext.GetMassProperties2(0, 0)
                                        except Exception as _e_two:
                                            mp = ext.GetMassProperties2(0, 0, 0)
                                    weight = float(mp[0]) if mp and len(mp) > 0 else 0.0
                            except Exception as e4:
                                connector_logger.error(f"Fehler bei Extension.GetMassProperties2: {e4}", exc_info=True)

                        # Versuch 5: Extension.CreateMassProperty().Mass (wenn verfügbar)
                        if weight == 0.0:
                            try:
                                ext = part_model.Extension
                                mp_obj = None
                                # Prefer CastTo for correct typelib binding if available
                                try:
                                    ext_typed = win32com.client.CastTo(ext, "IModelDocExtension")
                                except Exception:
                                    ext_typed = ext

                                # Try: CreateMassProperty (call) -> CreateMassProperty2 (call) -> CreateMassProperty (property)
                                try:
                                    if hasattr(ext_typed, "CreateMassProperty"):
                                        mp_obj = ext_typed.CreateMassProperty()
                                except Exception:
                                    pass
                                if mp_obj is None:
                                    try:
                                        if hasattr(ext_typed, "CreateMassProperty2"):
                                            mp_obj = ext_typed.CreateMassProperty2()
                                    except Exception:
                                        pass
                                if mp_obj is None:
                                    # some bindings expose it as a property
                                    try:
                                        mp_obj = getattr(ext_typed, "CreateMassProperty")
                                    except Exception:
                                        mp_obj = None

                                if mp_obj is not None:
                                    weight = float(getattr(mp_obj, "Mass", 0) or 0)
                            except Exception as e5:
                                connector_logger.error(f"Fehler bei CreateMassProperty: {e5}", exc_info=True)

                        # Lese Custom Properties (global + config)
                        properties = _read_custom_properties(part_model, config_name)
                    finally:
                        # Close by title/basename is more reliable than full path.
                        try:
                            self._close_doc_best_effort(part_model, part_path)
                        except Exception:
                            try:
                                self.sw_app.CloseDoc(part_path)
                            except Exception:
                                pass
                else:
                    if is_hidden:
                        hidden_count += 1

                # Füge Teil-Info hinzu (auch wenn part_model nicht geöffnet werden konnte)
                results.append([
                    child,  # [0] Position
                    part_name,  # [1] Partname
                    config_name,  # [2] Configuration
                    None,  # [3] Reserved
                    None,  # [4] Property Name (wird in Schleife gefüllt)
                    None,  # [5] Property Value (wird in Schleife gefüllt)
                    None,  # [6] Reserved
                    x_dim,  # [7] X-Dimension
                    y_dim,  # [8] Y-Dimension
                    z_dim,  # [9] Z-Dimension
                    weight,  # [10] Gewicht
                    part_path,  # [11] Filepath Part/ASM
                    drawing_path,  # [12] Filepath Drawing
                    1 if is_hidden else 0,  # [13] Exclude from Boom
                ])

                # Füge Properties hinzu
                for prop in properties:
                    results.append([
                        child,
                        part_name,
                        config_name,
                        None,
                        prop.get("name"),  # [4] Property Name
                        prop.get("value"),  # [5] Property Value
                        None,
                        x_dim,
                        y_dim,
                        z_dim,
                        weight,
                        part_path,
                        drawing_path,
                        1 if is_hidden else 0,
                    ])

                child += 1
            connector_logger.info(
                f"Assembly scan done. hidden_count={hidden_count}, missing_path_count={missing_path_count}, total_components={len(components)}"
            )
        finally:
            try:
                self._close_doc_best_effort(sw_model, assembly_filepath)
            except Exception:
                try:
                    self.sw_app.CloseDoc(assembly_filepath)
                except Exception:
                    pass
            # Keep SOLIDWORKS running; only close documents to avoid locking files.
        
        return results

    def set_custom_properties(
        self,
        filepath: str,
        configuration: str | None,
        properties: Dict[str, Optional[str]],
        scope: str = "both_pref_config",
    ) -> Dict[str, Any]:
        """Setzt Custom Properties konfigurationsspezifisch in einem SOLIDWORKS Dokument (kein globaler Fallback)."""
        if not filepath:
            raise Exception("filepath fehlt")

        if not self.sw_app:
            if not self.connect():
                raise Exception("Konnte nicht zu SOLIDWORKS verbinden")

        # Defensive: ensure we do not use a COM object from a different thread
        current_tid = threading.get_ident()
        if self._owner_thread_id is not None and self._owner_thread_id != current_tid:
            raise Exception("Interner Fehler: SOLIDWORKS COM Objekt wurde in anderem Thread erstellt (Thread-Mismatch)")

        if not os.path.exists(filepath):
            raise Exception(f"Datei nicht gefunden: {filepath}")

        # Pre-check: is this document already open in the connected SOLIDWORKS instance?
        # If yes, we should NOT close it (it's user/assembly state). We'll update properties in-place.
        pre_open_doc = None
        opened_here = True
        try:
            pre_by_path = None
            try:
                pre_by_path = self.sw_app.GetOpenDocumentByName(filepath)
            except Exception:
                pre_by_path = None
            if pre_by_path is not None:
                pre_open_doc = pre_by_path
                opened_here = False
        except Exception:
            pass

        ext = str(filepath).upper()
        if ext.endswith(".SLDPRT"):
            doc_type = 1
        elif ext.endswith(".SLDASM"):
            doc_type = 2
        elif ext.endswith(".SLDDRW"):
            doc_type = 3
        else:
            raise Exception("Unsupported file type (expected .SLDPRT/.SLDASM/.SLDDRW)")

        sw_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        sw_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        if pre_open_doc is not None:
            sw_model = pre_open_doc
        else:
            sw_model = self.sw_app.OpenDoc6(filepath, doc_type, 0, "", sw_errors, sw_warnings)
            if not sw_model:
                raise Exception(f"Konnte Dokument nicht öffnen: {filepath}")

        try:
            def _get_str_member(obj, name: str) -> Optional[str]:
                try:
                    v = getattr(obj, name, None)
                except Exception:
                    return None
                try:
                    v2 = v() if callable(v) else v
                except Exception:
                    v2 = v
                if v2 is None:
                    return None
                s = str(v2).strip()
                return s or None

            title = _get_str_member(sw_model, "GetTitle") or _get_str_member(sw_model, "Title")
            path_name = _get_str_member(sw_model, "GetPathName") or _get_str_member(sw_model, "PathName")
        except Exception:
            pass

        updated = []
        failed = []

        def _try_set(mgr, name: str, value: str) -> bool:
            def _readback(mgr2, n: str) -> str:
                try:
                    if hasattr(mgr2, "Get4"):
                        try:
                            vt_bstr_byref = pythoncom.VT_BSTR | pythoncom.VT_BYREF
                            v_raw = win32com.client.VARIANT(vt_bstr_byref, "")
                            v_res = win32com.client.VARIANT(vt_bstr_byref, "")
                            mgr2.Get4(str(n), False, v_raw, v_res)
                            raw = (getattr(v_raw, "value", None) or "").strip()
                            res = (getattr(v_res, "value", None) or "").strip()
                            return res or raw
                        except Exception:
                            pass
                    if hasattr(mgr2, "Get2"):
                        try:
                            r2 = mgr2.Get2(str(n), "")
                        except Exception:
                            r2 = mgr2.Get2(str(n))
                        return (str(r2) if r2 is not None else "").strip()
                except Exception:
                    return ""
                return ""

            # Prefer Set2 (update existing), fallback to Add3 (create)
            try:
                if hasattr(mgr, "Set2"):
                    ok = mgr.Set2(name, value)
                    if bool(ok):
                        # Some SOLIDWORKS bindings return success even if nothing changed/created.
                        # Verify by reading back; if empty, continue with Add* fallback.
                        rb = _readback(mgr, name)
                        if rb != "":
                            return True
            except Exception:
                pass

            # swCustomInfoType_e: Text = 30 (common)
            info_type = 30
            # Try Add3 variants
            try:
                if hasattr(mgr, "Add3"):
                    try:
                        # (Name, Type, Value, Options)
                        mgr.Add3(name, info_type, value, 0)
                        return _readback(mgr, name) != ""
                    except Exception:
                        # some versions require different options
                        mgr.Add3(name, info_type, value, 2)
                        return _readback(mgr, name) != ""
            except Exception:
                pass

            # Try Add2 variants
            try:
                if hasattr(mgr, "Add2"):
                    mgr.Add2(name, info_type, value)
                    return _readback(mgr, name) != ""
            except Exception:
                pass

            return False

        try:
            doc_ext = sw_model.Extension

            # Resolve target configuration (config-specific only):
            # - try requested configuration first
            # - else try "Standard"
            # - else fall back to ActiveConfiguration
            cfg_req = (configuration or "").strip()

            cfg_names: list[str] = []
            try:
                get_cfg_names = getattr(sw_model, "GetConfigurationNames", None)
                names = get_cfg_names() if callable(get_cfg_names) else get_cfg_names
                cfg_names = [str(n) for n in (list(names) if names else [])]
            except Exception:
                cfg_names = []

            def _cfg_known(name: str) -> bool:
                if not name or not cfg_names:
                    return True  # unknown list -> don't block attempts
                try:
                    nl = str(name).strip().lower()
                    return any(str(n).strip().lower() == nl for n in cfg_names)
                except Exception:
                    return True

            active_name = None
            try:
                active_name = sw_model.ConfigurationManager.ActiveConfiguration.Name
            except Exception:
                active_name = None

            cfg_candidates = []
            if cfg_req:
                cfg_candidates.append(cfg_req)
            cfg_candidates.append("Standard")
            if active_name:
                cfg_candidates.append(active_name)

            mgr = None
            last_mgr_err = None
            for cfg_name in cfg_candidates:
                if not cfg_name or not _cfg_known(cfg_name):
                    continue
                try:
                    mgr = doc_ext.CustomPropertyManager(cfg_name)
                    if mgr is not None:
                        break
                except Exception as e:
                    last_mgr_err = e
                    mgr = None
                    continue

            if mgr is None:
                raise Exception(f"Konnte CustomPropertyManager für Konfiguration nicht erhalten (requested='{cfg_req}'): {last_mgr_err}")

            for raw_name, raw_val in (properties or {}).items():
                name = (raw_name or "").strip()
                if not name:
                    continue
                # Avoid overwriting existing SOLIDWORKS properties with empty strings.
                if raw_val is None:
                    continue
                value = str(raw_val)
                if value.strip() == "":
                    continue

                try:
                    ok = _try_set(mgr, name, value)
                except Exception as e:
                    ok = False
                    failed.append({"name": name, "reason": str(e)})
                    continue

                if ok:
                    updated.append(name)
                else:
                    failed.append({"name": name, "reason": "Set/Add failed"})

            # Save (best effort)
            try:
                if hasattr(sw_model, "Save3"):
                    save_err = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    save_warn = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    sw_model.Save3(1, save_err, save_warn)
                else:
                    sw_model.Save()
            except Exception:
                # Save failures should be surfaced
                raise
        finally:
            try:
                if opened_here:
                    self._close_doc_best_effort(sw_model, filepath)
            except Exception:
                pass
            # Keep SOLIDWORKS running; only close documents to avoid locking files.

        return {"updated": updated, "failed": failed, "updated_count": len(updated), "failed_count": len(failed)}
    
    def create_3d_documents(
        self,
        sw_filepath_with_documentname: str,
        step: bool = False,
        x_t: bool = False,
        stl: bool = False
    ) -> bool:
        """
        Erstellt 3D-Dokumente (STEP, X_T, STL) aus SOLIDWORKS-Datei
        
        Entspricht VBA Create_3D_Documents()
        """
        _agent_log(
            "C",
            "SolidWorksConnector.py:create_3d_documents",
            "enter",
            {"filepath": sw_filepath_with_documentname, "step": step, "x_t": x_t, "stl": stl},
        )

        if not self.sw_app:
            if not self.connect():
                _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "connect_failed", {})
                return False

        # Ensure COM initialized on the current thread (FastAPI threadpool may change threads).
        try:
            pythoncom.CoInitialize()
            _agent_log(
                "C",
                "SolidWorksConnector.py:create_3d_documents",
                "coinitialize_ok",
                {"thread": threading.get_ident(), "owner_thread": getattr(self, "_owner_thread_id", None)},
            )
        except Exception as _ci:
            _agent_log(
                "C",
                "SolidWorksConnector.py:create_3d_documents",
                "coinitialize_failed",
                {"err": f"{type(_ci).__name__}: {_ci}", "thread": threading.get_ident(), "owner_thread": getattr(self, "_owner_thread_id", None)},
            )
        
        # Prüfe ob Datei .SLDPRT oder .SLDASM ist
        if not (sw_filepath_with_documentname.endswith(".SLDPRT") or 
                sw_filepath_with_documentname.endswith(".SLDASM")):
            return False
        
        # Erstelle Pfadname ohne Endung
        s_pathname = sw_filepath_with_documentname[:-7]  # Entferne ".SLDPRT" oder ".SLDASM"
        
        # Bestimme Dokumenttyp
        # SOLIDWORKS swDocumentTypes_e: PART=1, ASSEMBLY=2, DRAWING=3
        doc_type = 1 if sw_filepath_with_documentname.endswith(".SLDPRT") else 2  # swDocPART oder swDocASSEMBLY
        
        # Öffne Dokument
        part_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        part_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        _t_open0 = time.monotonic()
        sw_part = self.sw_app.OpenDoc6(
            sw_filepath_with_documentname,
            doc_type,
            0,  # swOpenDocOptions_Silent
            "",
            part_errors,
            part_warnings
        )
        _agent_log(
            "C",
            "SolidWorksConnector.py:create_3d_documents",
            "open_done",
            {
                "elapsed_ms": int((time.monotonic() - _t_open0) * 1000),
                "errors": getattr(part_errors, "value", None),
                "warnings": getattr(part_warnings, "value", None),
                "opened": bool(sw_part),
            },
        )
        
        if not sw_part:
            _agent_log(
                "C",
                "SolidWorksConnector.py:create_3d_documents",
                "open_failed",
                {"errors": getattr(part_errors, "value", None), "warnings": getattr(part_warnings, "value", None)},
            )
            return False
        
        try:
            # Aktiviere Dokument
            _t_act0 = time.monotonic()
            try:
                self.sw_app.ActivateDoc(sw_filepath_with_documentname)
            finally:
                _agent_log(
                    "C",
                    "SolidWorksConnector.py:create_3d_documents",
                    "activate_done",
                    {"elapsed_ms": int((time.monotonic() - _t_act0) * 1000)},
                )
            
            # STEP-Datei erstellen
            if step:
                # Setze STEP-Export-Optionen (AP214)
                self.sw_app.SetUserPreferenceIntegerValue(214, 214)  # swStepAP = 214
                # Speichere als STEP
                out = f"{s_pathname}.stp"
                _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "saveas_step_start", {"out": out})
                # Avoid overwrite prompts / locked file issues.
                try:
                    if os.path.exists(out):
                        os.remove(out)
                        _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_ok", {"out": out})
                except Exception as _pd:
                    _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_failed", {"out": out, "err": f"{type(_pd).__name__}: {_pd}"})
                _t_save0 = time.monotonic()
                ok = sw_part.SaveAs2(out, 0, True, False)
                elapsed_ms = int((time.monotonic() - _t_save0) * 1000)
                exists_immediate = False
                size_immediate = None
                try:
                    exists_immediate = os.path.exists(out)
                    size_immediate = os.path.getsize(out) if exists_immediate else None
                except Exception:
                    pass
                _agent_log(
                    "C",
                    "SolidWorksConnector.py:create_3d_documents",
                    "saveas_step_return",
                    {"out": out, "ok": bool(ok), "elapsed_ms": elapsed_ms, "exists_immediate": exists_immediate, "size_immediate": size_immediate},
                )
                # Some SOLIDWORKS versions return True but finish writing asynchronously.
                step_alts = [f"{s_pathname}.step", f"{s_pathname}.STP", f"{s_pathname}.STEP"]
                # Even if ok==False, a file might still appear.
                ok_wait, realized = self._wait_for_file(out, step_alts, timeout_s=18.0, location="SolidWorksConnector.py:create_3d_documents")
                if realized and realized != out:
                    out = realized

                # Fallback: Extension.SaveAs (sometimes blocks more reliably) – only if still missing.
                if not os.path.exists(out):
                    try:
                        e = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        w = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        # exportData is optional; pass None (VT_EMPTY) – pythoncom.Missing can't be converted to VARIANT.
                        try:
                            _t_ext0 = time.monotonic()
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, None, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_step_ext_variant",
                                {"variant": "exportData=None"},
                            )
                        except Exception:
                            _t_ext0 = time.monotonic()
                            export_data = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, export_data, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_step_ext_variant",
                                {"variant": "exportData=VT_DISPATCH(None)"},
                            )
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_step_ext_return",
                            {
                                "out": out,
                                "ok": bool(ok2),
                                "elapsed_ms": int((time.monotonic() - _t_ext0) * 1000),
                                "errors": getattr(e, "value", None),
                                "warnings": getattr(w, "value", None),
                            },
                        )
                    except Exception as _e2:
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_step_ext_exception",
                            {"out": out, "err": f"{type(_e2).__name__}: {_e2}"},
                        )
                # Final wait after fallback attempt
                if not os.path.exists(out):
                    ok_wait2, realized2 = self._wait_for_file(out, step_alts, timeout_s=12.0, location="SolidWorksConnector.py:create_3d_documents")
                    if realized2 and realized2 != out:
                        out = realized2
                # If still missing, scan directory for unexpected output variants (e.g. encoding/case differences)
                if not os.path.exists(out):
                    try:
                        out_dir = os.path.dirname(out) or "."
                        base = os.path.basename(s_pathname).lower()
                        found = []
                        for fn in os.listdir(out_dir):
                            lfn = fn.lower()
                            if (lfn.endswith(".stp") or lfn.endswith(".step")) and base and lfn.startswith(base):
                                found.append(fn)
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_step_dir_scan",
                            {"dir": out_dir, "base": base, "found": found[:10], "found_count": len(found)},
                        )
                    except Exception as _e3:
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_step_dir_scan_exception",
                            {"out": out, "err": f"{type(_e3).__name__}: {_e3}"},
                        )
                # Extension variant (.step) fallback
                if (not os.path.exists(out)) and os.path.exists(f"{s_pathname}.step"):
                    out = f"{s_pathname}.step"
                try:
                    _agent_log(
                        "C",
                        "SolidWorksConnector.py:create_3d_documents",
                        "saveas_step_done",
                        {"out": out, "exists": os.path.exists(out), "size": os.path.getsize(out) if os.path.exists(out) else None},
                    )
                except Exception:
                    pass
                if not os.path.exists(out):
                    raise Exception(f"STEP Export fehlgeschlagen (SaveAs2_ok={bool(ok)}), fehlend: {out}")
            
            # X_T-Datei erstellen
            if x_t:
                # Speichere als X_T
                out = f"{s_pathname}.x_t"
                _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "saveas_xt_start", {"out": out})
                try:
                    if os.path.exists(out):
                        os.remove(out)
                        _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_ok", {"out": out})
                except Exception as _pd:
                    _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_failed", {"out": out, "err": f"{type(_pd).__name__}: {_pd}"})

                _t_save0 = time.monotonic()
                ok = sw_part.SaveAs2(out, 0, True, False)
                elapsed_ms = int((time.monotonic() - _t_save0) * 1000)
                exists_immediate = False
                size_immediate = None
                try:
                    exists_immediate = os.path.exists(out)
                    size_immediate = os.path.getsize(out) if exists_immediate else None
                except Exception:
                    pass
                _agent_log(
                    "C",
                    "SolidWorksConnector.py:create_3d_documents",
                    "saveas_xt_return",
                    {"out": out, "ok": bool(ok), "elapsed_ms": elapsed_ms, "exists_immediate": exists_immediate, "size_immediate": size_immediate},
                )

                xt_alts = [f"{s_pathname}.X_T"]
                self._wait_for_file(out, xt_alts, timeout_s=18.0, location="SolidWorksConnector.py:create_3d_documents")
                if not os.path.exists(out):
                    try:
                        e = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        w = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        try:
                            _t_ext0 = time.monotonic()
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, None, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_xt_ext_variant",
                                {"variant": "exportData=None"},
                            )
                        except Exception:
                            _t_ext0 = time.monotonic()
                            export_data = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, export_data, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_xt_ext_variant",
                                {"variant": "exportData=VT_DISPATCH(None)"},
                            )
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_xt_ext_return",
                            {
                                "out": out,
                                "ok": bool(ok2),
                                "elapsed_ms": int((time.monotonic() - _t_ext0) * 1000),
                                "errors": getattr(e, "value", None),
                                "warnings": getattr(w, "value", None),
                            },
                        )
                    except Exception as _e2:
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_xt_ext_exception",
                            {"out": out, "err": f"{type(_e2).__name__}: {_e2}"},
                        )
                if not os.path.exists(out):
                    raise Exception(f"X_T Export fehlgeschlagen (SaveAs2_ok={bool(ok)}), fehlend: {out}")
                try:
                    _agent_log(
                        "C",
                        "SolidWorksConnector.py:create_3d_documents",
                        "saveas_xt_done",
                        {"out": out, "exists": os.path.exists(out), "size": os.path.getsize(out) if os.path.exists(out) else None},
                    )
                except Exception:
                    pass
            
            # STL-Datei erstellen
            if stl:
                # Speichere als STL
                out = f"{s_pathname}.stl"
                _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "saveas_stl_start", {"out": out})
                try:
                    if os.path.exists(out):
                        os.remove(out)
                        _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_ok", {"out": out})
                except Exception as _pd:
                    _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "predelete_failed", {"out": out, "err": f"{type(_pd).__name__}: {_pd}"})

                _t_save0 = time.monotonic()
                ok = sw_part.SaveAs2(out, 0, True, False)
                elapsed_ms = int((time.monotonic() - _t_save0) * 1000)
                exists_immediate = False
                size_immediate = None
                try:
                    exists_immediate = os.path.exists(out)
                    size_immediate = os.path.getsize(out) if exists_immediate else None
                except Exception:
                    pass
                _agent_log(
                    "C",
                    "SolidWorksConnector.py:create_3d_documents",
                    "saveas_stl_return",
                    {"out": out, "ok": bool(ok), "elapsed_ms": elapsed_ms, "exists_immediate": exists_immediate, "size_immediate": size_immediate},
                )

                stl_alts = [f"{s_pathname}.STL"]
                self._wait_for_file(out, stl_alts, timeout_s=18.0, location="SolidWorksConnector.py:create_3d_documents")
                if not os.path.exists(out):
                    try:
                        e = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        w = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                        try:
                            _t_ext0 = time.monotonic()
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, None, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_stl_ext_variant",
                                {"variant": "exportData=None"},
                            )
                        except Exception:
                            _t_ext0 = time.monotonic()
                            export_data = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)
                            ok2 = sw_part.Extension.SaveAs(out, 0, 0, export_data, e, w)
                            _agent_log(
                                "C",
                                "SolidWorksConnector.py:create_3d_documents",
                                "saveas_stl_ext_variant",
                                {"variant": "exportData=VT_DISPATCH(None)"},
                            )
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_stl_ext_return",
                            {
                                "out": out,
                                "ok": bool(ok2),
                                "elapsed_ms": int((time.monotonic() - _t_ext0) * 1000),
                                "errors": getattr(e, "value", None),
                                "warnings": getattr(w, "value", None),
                            },
                        )
                    except Exception as _e2:
                        _agent_log(
                            "C",
                            "SolidWorksConnector.py:create_3d_documents",
                            "saveas_stl_ext_exception",
                            {"out": out, "err": f"{type(_e2).__name__}: {_e2}"},
                        )
                if not os.path.exists(out):
                    raise Exception(f"STL Export fehlgeschlagen (SaveAs2_ok={bool(ok)}), fehlend: {out}")
                try:
                    _agent_log(
                        "C",
                        "SolidWorksConnector.py:create_3d_documents",
                        "saveas_stl_done",
                        {"out": out, "exists": os.path.exists(out), "size": os.path.getsize(out) if os.path.exists(out) else None},
                    )
                except Exception:
                    pass
            
            _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "exit_true", {})
            return True
            
        finally:
            _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "finally_close_start", {"filepath": sw_filepath_with_documentname})
            try:
                # Avoid hidden modal dialogs during CloseDoc (macro best practice)
                prev_cmd = None
                try:
                    prev_cmd = getattr(self.sw_app, "CommandInProgress", None)
                    self.sw_app.CommandInProgress = True
                    _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "command_in_progress_set", {"prev": prev_cmd})
                except Exception as _e:
                    _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "command_in_progress_set_failed", {"err": f"{type(_e).__name__}: {_e}"})

                self._close_doc_best_effort(sw_part, sw_filepath_with_documentname)

                try:
                    if prev_cmd is not None:
                        self.sw_app.CommandInProgress = prev_cmd
                        _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "command_in_progress_restored", {"restored": prev_cmd})
                except Exception:
                    pass
            except Exception:
                try:
                    self.sw_app.CloseDoc(sw_filepath_with_documentname)
                except Exception:
                    pass
            _agent_log("C", "SolidWorksConnector.py:create_3d_documents", "finally_close_done", {"filepath": sw_filepath_with_documentname})

    def create_2d_documents(
        self,
        sw_drawing_path: str,
        pdf: bool = False,
        dxf: bool = False,
        bestell_pdf: bool = False,
        bestell_dxf: bool = False,
        note_identifier: str = "Detailelement219@Blatt1",
        note_type: str = "NOTE",
        note_move_dx: float = 0.05,
        note_select_x: float = 0.4085463729713,
        note_select_y: float = 0.2481705436474,
    ) -> Dict[str, Any]:
        """
        Erstellt 2D-Dokumente (PDF, DXF) aus einer SOLIDWORKS-Zeichnung (.SLDDRW).

        Für Bestell-Varianten wird eine definierte Notiz temporär aus dem Drawing verschoben,
        exportiert und anschließend wieder zurückgesetzt, so dass:
        - sie nicht in Bestell-PDF/DXF erscheint
        - sie weiterhin in normaler PDF/DXF erscheint
        - keine dauerhafte Änderung am .SLDDRW bleibt

        Returns:
            dict: {success: bool, created_files: [str], warnings: [str]}
        """
        warnings: List[str] = []
        created_files: List[str] = []

        if not self.sw_app:
            if not self.connect():
                return {"success": False, "created_files": [], "warnings": ["Konnte nicht zu SOLIDWORKS verbinden"]}

        # Defensive: ensure we do not use a COM object from a different thread
        current_tid = threading.get_ident()
        if self._owner_thread_id is not None and self._owner_thread_id != current_tid:
            connector_logger.error(f"COM object thread mismatch: owner={self._owner_thread_id}, current={current_tid}")
            return {
                "success": False,
                "created_files": [],
                "warnings": ["Interner Fehler: SOLIDWORKS COM Objekt wurde in anderem Thread erstellt (Thread-Mismatch)"],
            }

        if not sw_drawing_path:
            return {"success": False, "created_files": [], "warnings": ["Kein Zeichnungspfad angegeben"]}

        if not os.path.exists(sw_drawing_path):
            return {"success": False, "created_files": [], "warnings": [f"Zeichnung nicht gefunden: {sw_drawing_path}"]}

        _, ext = os.path.splitext(sw_drawing_path)
        if ext.lower() != ".slddrw":
            return {"success": False, "created_files": [], "warnings": [f"Ungültige Zeichnung (erwartet .SLDDRW): {sw_drawing_path}"]}

        base_path = os.path.splitext(sw_drawing_path)[0]

        # Öffne Zeichnung
        sw_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        sw_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        sw_model = self.sw_app.OpenDoc6(
            sw_drawing_path,
            3,  # swDocDRAWING
            0,  # swOpenDocOptions_Silent
            "",
            sw_errors,
            sw_warnings,
        )
        connector_logger.debug(f"OpenDoc6(DRW) errors={sw_errors.value} warnings={sw_warnings.value}")

        if not sw_model:
            return {"success": False, "created_files": [], "warnings": [f"Konnte Zeichnung nicht öffnen: {sw_drawing_path}"]}

        note_moved = False
        note_hidden = False
        note_ann_obj = None
        note_deleted = False
        try:
            # Aktiviere Dokument (hilft teils bei SaveAs/Selection)
            try:
                self.sw_app.ActivateDoc(sw_drawing_path)
            except Exception:
                pass

            sw_ext = sw_model.Extension

            def _export_pdf(target_path: str) -> None:
                try:
                    export_data = None
                    try:
                        # swExportPdfData = 1 (swExportDataFileType_e)
                        export_data = self.sw_app.GetExportFileData(1)
                        # All sheets (best effort): swExportDataSheetsToExport_e.swExportData_ExportAllSheets = 1
                        try:
                            export_data.SetSheets(1, 1)
                        except Exception:
                            pass
                    except Exception as e_ed:
                        warnings.append(f"PDF Export-Optionen konnten nicht gesetzt werden: {e_ed}")
                        export_data = None

                    e = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    w = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    ok = sw_ext.SaveAs(target_path, 0, 0, export_data, e, w)
                    if not ok:
                        raise Exception(f"SaveAs returned False (errors={e.value}, warnings={w.value})")
                except Exception as ex:
                    raise Exception(f"PDF Export fehlgeschlagen ({target_path}): {ex}")

            def _export_dxf(target_path: str) -> None:
                try:
                    # Normalize Windows path separators (we observed mixed / and \ in runtime)
                    if _is_windows_path := (len(target_path) >= 3 and target_path[1] == ":" and target_path[2] in ("\\", "/")):
                        target_path = target_path.replace("/", "\\")

                    e = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    w = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)

                    # Versuch 1: ModelDoc2.SaveAs2 (häufig stabiler als Extension.SaveAs für DXF)
                    try:
                        sw_model.SaveAs2(target_path, 0, True, False)
                        ok = True
                    except Exception as e1:
                        # Versuch 2: Extension.SaveAs mit 'Missing' statt None (vermeidet Typenkonflikt)
                        # pythoncom hat DISP_E_PARAMNOTFOUND nicht in allen Builds; winerror ist stabil.
                        missing = win32com.client.VARIANT(pythoncom.VT_ERROR, getattr(winerror, "DISP_E_PARAMNOTFOUND", -2147352572))
                        ok = sw_ext.SaveAs(target_path, 0, 0, missing, e, w)

                    if not ok:
                        raise Exception(f"SaveAs returned False (errors={e.value}, warnings={w.value})")
                except Exception as ex:
                    raise Exception(f"DXF Export fehlgeschlagen ({target_path}): {ex}")

            # Normal-Exports (ohne Notiz-Manipulation)
            if pdf:
                out = f"{base_path}.pdf"
                _export_pdf(out)
                created_files.append(out)
            if dxf:
                out = f"{base_path}.dxf"
                _export_dxf(out)
                created_files.append(out)

            # Bestell-Exports: Notiz temporär manipulieren
            # WICHTIG: DXF scheint "Hidden/Off-sheet" teils dennoch zu exportieren.
            # Daher nutzen wir für Bestell-DXF bevorzugt die robusteste Strategie:
            # - Notiz selektieren -> löschen -> DXF exportieren -> Undo
            # und manipulieren die Notiz dafür NICHT via Move/Visible.
            if bestell_pdf or bestell_dxf:
                try:
                    # Select the note (best effort)
                    selected = False

                    def _select_note() -> tuple[bool, str]:
                        """
                        pywin32/SOLIDWORKS COM ist bei SelectByID2 sehr empfindlich bzgl. Parametertypen.
                        Wir probieren mehrere Signaturen:
                        - ohne Koordinaten (0,0,0) vs. mit VBA-Koordinaten
                        - Callout als None vs. als COM-Missing vs. als VT_DISPATCH(None)
                        """
                        callout_none = None
                        callout_missing = win32com.client.VARIANT(
                            pythoncom.VT_ERROR, getattr(winerror, "DISP_E_PARAMNOTFOUND", -2147352572)
                        )
                        callout_dispatch_none = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)

                        attempts = [
                            ("xyz0_callout_none", 0.0, 0.0, 0.0, callout_none),
                            ("xyz0_callout_missing", 0.0, 0.0, 0.0, callout_missing),
                            ("xyz0_callout_dispatch_none", 0.0, 0.0, 0.0, callout_dispatch_none),
                            ("vba_xyz_callout_none", float(note_select_x), float(note_select_y), 0.0, callout_none),
                            ("vba_xyz_callout_missing", float(note_select_x), float(note_select_y), 0.0, callout_missing),
                            ("vba_xyz_callout_dispatch_none", float(note_select_x), float(note_select_y), 0.0, callout_dispatch_none),
                        ]

                        last_err: str | None = None
                        for name, x, y, z, callout in attempts:
                            try:
                                ok = bool(sw_ext.SelectByID2(note_identifier, note_type, x, y, z, False, 0, callout, 0))
                                if ok:
                                    return True, name
                            except Exception as e_sel:
                                last_err = str(e_sel)
                                continue
                        if last_err:
                            warnings.append(f"Notiz-Selektion fehlgeschlagen ({note_identifier}): {last_err}")
                        return False, "all_attempts_failed"

                    selected, selected_via = _select_note()

                    # For Bestell-PDF we still move/hide; for Bestell-DXF we prefer delete+undo.
                    if selected and bestell_pdf:
                        try:
                            # Capture the selected object/annotation BEFORE clearing selection,
                            # so we can toggle visibility even after ClearSelection2.
                            try:
                                sel_mgr = sw_model.SelectionManager
                                sel_obj = sel_mgr.GetSelectedObject6(1, -1)
                                # Try to get the IAnnotation object in multiple ways
                                ann = None
                                try:
                                    ann = win32com.client.CastTo(sel_obj, "IAnnotation")
                                except Exception:
                                    ann = None
                                if ann is None:
                                    try:
                                        ga = getattr(sel_obj, "GetAnnotation", None)
                                        ann = ga() if callable(ga) else ga
                                    except Exception:
                                        ann = None
                                note_ann_obj = ann or sel_obj
                            except Exception as e_cap:
                                warnings.append(f"Notiz-Objekt konnte nicht ermittelt werden ({note_identifier}): {e_cap}")

                            # Move out of drawing (relative move). Different SW versions expose different signatures.
                            moved_ok = False
                            moved_via = None
                            try:
                                # Prefer VBA signature: MoveOrCopy Copy, Ncopy, KeepRelations, RotX, RotY, RotZ, TransX, TransY, TransZ
                                sw_ext.MoveOrCopy(False, 1, False, 0, 0, 0, float(note_move_dx), 0.0, 0.0)
                                moved_ok = True
                                moved_via = "vba_9params"
                            except Exception as e_mv1:
                                try:
                                    # Fallback: some typelibs accept shorter signature
                                    sw_ext.MoveOrCopy(False, float(note_move_dx), 0.0, 0.0)
                                    moved_ok = True
                                    moved_via = "short_4params"
                                except Exception as e_mv2:
                                    warnings.append(f"Notiz konnte nicht verschoben werden ({note_identifier}): {e_mv1} / {e_mv2}")

                            if not moved_ok:
                                raise Exception("MoveOrCopy failed (all signatures)")
                            note_moved = True
                        except Exception as mv_err:
                            warnings.append(f"Notiz konnte nicht verschoben werden ({note_identifier}): {mv_err}")
                    elif not selected:
                        warnings.append(f"Notiz nicht gefunden/selektierbar: {note_identifier}")

                    def _set_note_visible(obj, visible: bool) -> tuple[bool, str]:
                        """
                        DXF-Export kann Text/Notizen auch dann noch ausgeben, wenn sie nur "vom Blatt weg" verschoben wurden.
                        Daher versuchen wir für Bestell-DXF zusätzlich, die selektierte Notiz wirklich auszublenden.
                        """
                        if obj is None:
                            return False, "No annotation object available"

                        ann = obj

                        # Versuch 1: Visible-Property
                        try:
                            setattr(ann, "Visible", bool(visible))
                            return True, "annotation.Visible"
                        except Exception:
                            pass

                        # Versuch 2: SetVisible2 (Signature variiert)
                        try:
                            m = getattr(ann, "SetVisible2", None)
                            if callable(m):
                                try:
                                    m(bool(visible), 0)
                                except Exception:
                                    m(bool(visible), 1)
                                return True, "annotation.SetVisible2"
                        except Exception:
                            pass

                        # Versuch 3: SetVisible
                        try:
                            m = getattr(ann, "SetVisible", None)
                            if callable(m):
                                m(bool(visible))
                                return True, "annotation.SetVisible"
                        except Exception:
                            pass

                        return False, "No supported visibility API on annotation"

                    def _delete_selected_note() -> tuple[bool, str]:
                        """
                        Fallback-Strategie für DXF: Notiz wirklich löschen (nicht nur ausblenden/verschieben),
                        exportieren, dann Undo (oder spätestens Close ohne Speichern).
                        """
                        # Try ModelDoc2.EditDelete (common)
                        try:
                            sw_model.EditDelete()
                            return True, "sw_model.EditDelete"
                        except Exception as e1:
                            pass

                        # Try IModelDocExtension.DeleteSelection2
                        try:
                            # 0 = default options (best effort)
                            ok = bool(sw_ext.DeleteSelection2(0))
                            if ok:
                                return True, "sw_ext.DeleteSelection2(0)"
                            return False, "sw_ext.DeleteSelection2 returned False"
                        except Exception as e2:
                            return False, f"DeleteSelection2 failed: {e1} / {e2}"

                    def _undo_last() -> tuple[bool, str]:
                        try:
                            sw_model.EditUndo2(1)
                            return True, "sw_model.EditUndo2(1)"
                        except Exception as e1:
                            try:
                                sw_model.EditUndo()
                                return True, "sw_model.EditUndo"
                            except Exception as e2:
                                return False, f"Undo failed: {e1} / {e2}"
                finally:
                    try:
                        sw_model.ClearSelection2(True)
                    except Exception:
                        pass

                # Exporte erzeugen (auch wenn Notiz nicht verschoben werden konnte)
                if bestell_pdf:
                    out = f"{base_path} Bestellzng.pdf"
                    _export_pdf(out)
                    created_files.append(out)
                if bestell_dxf:
                    # Bestell-DXF: Notiz temporär löschen (robusteste Strategie) und Undo danach.
                    if selected:
                        try:
                            # Reselect note to ensure delete acts on it
                            # Using the already proven callout_dispatch_none path
                            callout_dispatch_none = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)
                            reselected = bool(sw_ext.SelectByID2(note_identifier, note_type, 0.0, 0.0, 0.0, False, 0, callout_dispatch_none, 0))

                            if reselected:
                                ok_del, del_via = _delete_selected_note()

                                if ok_del:
                                    note_deleted = True
                                else:
                                    warnings.append(f"Notiz konnte nicht gelöscht werden ({note_identifier}): {del_via}")
                        finally:
                            try:
                                sw_model.ClearSelection2(True)
                            except Exception:
                                pass

                    out = f"{base_path} Bestellzng.dxf"
                    _export_dxf(out)
                    created_files.append(out)

                    # Undo delete after export (so drawing remains intact)
                    if note_deleted:
                        ok_undo, undo_via = _undo_last()

                        if not ok_undo:
                            warnings.append(f"Undo nach Notiz-Löschung fehlgeschlagen ({note_identifier}): {undo_via}")

        finally:
            # Notiz wieder zurücksetzen, falls verschoben (nur relevant für Bestell-PDF Strategie).
            if note_moved:
                try:
                    sw_ext = sw_model.Extension
                    selected = False
                    selected_via = "restore_not_attempted"

                    def _select_note_for_restore() -> tuple[bool, str]:
                        callout_none = None
                        callout_missing = win32com.client.VARIANT(
                            pythoncom.VT_ERROR, getattr(winerror, "DISP_E_PARAMNOTFOUND", -2147352572)
                        )
                        callout_dispatch_none = win32com.client.VARIANT(pythoncom.VT_DISPATCH, None)

                        attempts = [
                            ("restore_xyz0_callout_dispatch_none", 0.0, 0.0, 0.0, callout_dispatch_none),
                            ("restore_xyz0_callout_missing", 0.0, 0.0, 0.0, callout_missing),
                            ("restore_vba_xyz_callout_dispatch_none", float(note_select_x), float(note_select_y), 0.0, callout_dispatch_none),
                            ("restore_vba_xyz_callout_missing", float(note_select_x), float(note_select_y), 0.0, callout_missing),
                        ]

                        last_err: str | None = None
                        for name, x, y, z, callout in attempts:
                            try:
                                ok = bool(sw_ext.SelectByID2(note_identifier, note_type, x, y, z, False, 0, callout, 0))
                                if ok:
                                    return True, name
                            except Exception as e_sel:
                                last_err = str(e_sel)
                                continue
                        if last_err:
                            warnings.append(f"Notiz-Selektion für Restore fehlgeschlagen ({note_identifier}): {last_err}")
                        return False, "restore_all_attempts_failed"

                    selected, selected_via = _select_note_for_restore()

                    if selected:
                        try:
                            # Restore visibility first (if we hid it for Bestell-DXF)
                            if note_hidden:
                                ok_show, show_via = _set_note_visible(note_ann_obj, True)
                                if not ok_show:
                                    warnings.append(f"Notiz konnte beim Restore nicht eingeblendet werden ({note_identifier}): {show_via}")

                            restored_ok = False
                            restored_via = None
                            try:
                                sw_ext.MoveOrCopy(False, 1, False, 0, 0, 0, float(-note_move_dx), 0.0, 0.0)
                                restored_ok = True
                                restored_via = "vba_9params"
                            except Exception as e_r1:
                                try:
                                    sw_ext.MoveOrCopy(False, float(-note_move_dx), 0.0, 0.0)
                                    restored_ok = True
                                    restored_via = "short_4params"
                                except Exception as e_r2:
                                    warnings.append(f"Notiz-Restore fehlgeschlagen ({note_identifier}): {e_r1} / {e_r2}")

                            if not restored_ok:
                                raise Exception("Restore MoveOrCopy failed (all signatures)")
                        except Exception as mv_err:
                            warnings.append(f"Notiz-Restore fehlgeschlagen ({note_identifier}): {mv_err}")
                    else:
                        warnings.append(f"Notiz für Restore nicht selektierbar: {note_identifier}")
                except Exception as restore_err:
                    warnings.append(f"Notiz-Restore unerwartet fehlgeschlagen: {restore_err}")
                finally:
                    try:
                        sw_model.ClearSelection2(True)
                    except Exception:
                        pass

            try:
                self._close_doc_best_effort(sw_model, sw_drawing_path)
            except Exception:
                # Best effort close
                pass

        return {"success": True, "created_files": created_files, "warnings": warnings}
