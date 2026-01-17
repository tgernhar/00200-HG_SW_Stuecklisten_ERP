"""
SOLIDWORKS Connector - Main Module
"""
import win32com.client
import os
import logging
import threading
import pythoncom
import getpass
import pywintypes
import ctypes
import winerror
from typing import List, Dict, Any, Optional

# Logger für SOLIDWORKS-Connector
connector_logger = logging.getLogger('solidworks_connector')


class SolidWorksConnector:
    """SOLIDWORKS Connector für COM API Zugriff"""
    
    def __init__(self):
        self.sw_app = None
        # Track which thread created the COM object (COM objects must stay on the same thread)
        self._owner_thread_id: int | None = None
        self._com_initialized: bool = False
    
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
            # Prefer attaching to an already running instance (common in user workflows).
            # If that fails, try Dispatch() (default context), then DispatchEx() with LOCAL_SERVER.
            connected_via = None
            last_err: Exception | None = None
            try:
                self.sw_app = win32com.client.GetActiveObject("SldWorks.Application")
                connected_via = "GetActiveObject"
            except Exception as e1:
                last_err = e1
                try:
                    self.sw_app = win32com.client.Dispatch("SldWorks.Application")
                    connected_via = "Dispatch"
                except Exception as e2:
                    last_err = e2
                    # Create a new instance in the local server context
                    self.sw_app = win32com.client.DispatchEx("SldWorks.Application", clsctx=pythoncom.CLSCTX_LOCAL_SERVER)
                    connected_via = "DispatchEx(CLSCTX_LOCAL_SERVER)"

            self.sw_app.Visible = False
            connector_logger.info("Erfolgreich zu SOLIDWORKS verbunden")
            connector_logger.info(f"Connected via: {connected_via}")
            return True
        except pywintypes.com_error as e:
            connector_logger.error(f"COM Fehler beim Verbinden zu SOLIDWORKS: {e}", exc_info=True)
            return False
        except Exception as e:
            connector_logger.error(f"Fehler beim Verbinden zu SOLIDWORKS: {e}", exc_info=True)
            return False
    
    def disconnect(self):
        """Verbindung zu SOLIDWORKS trennen"""
        if self.sw_app:
            self.sw_app = None
        # We intentionally do NOT call CoUninitialize here:
        # - Request threads may be reused by the server.
        # - Uninitializing COM while objects are still referenced can cause undefined behavior.
        # If needed, we can revisit with a dedicated COM thread model.
    
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
        sw_model = self.sw_app.OpenDoc6(
            assembly_filepath,
            2,  # swDocASSEMBLY
            0,  # swOpenDocOptions_Silent
            "",
            sw_errors,
            sw_warnings
        )
        connector_logger.debug(f"OpenDoc6(ASM) errors={sw_errors.value} warnings={sw_warnings.value}")
        
        if not sw_model:
            raise Exception(f"Konnte Assembly nicht öffnen: {assembly_filepath}")
        
        results = []
        child = 0
        
        try:
            # Traversiere Teilebaum
            asm_doc = sw_model
            try:
                asm_doc = win32com.client.CastTo(sw_model, "AssemblyDoc")
            except Exception:
                asm_doc = sw_model

            def _to_list_safe(x):
                if x is None:
                    return []
                try:
                    return list(x)
                except Exception:
                    return []

            # NOTE: SOLIDWORKS API param semantics differ (top-level-only vs all-levels).
            # We'll try multiple variants and fall back to root traversal if still empty.
            components = []
            raw_components = None
            try:
                raw_components = getattr(asm_doc, "GetComponents")(True)
                components = _to_list_safe(raw_components)
            except Exception:
                components = []
            if not components:
                try:
                    raw_components = getattr(asm_doc, "GetComponents")(False)
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

            hidden_count = 0
            missing_path_count = 0
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
                is_hidden = is_suppressed or is_envelope
                
                if not is_hidden:
                    # Lese Part/Assembly
                    part_path = _get_str_attr(component, "GetPathName")
                    part_name = _get_str_attr(component, "Name2")
                    config_name = _get_str_attr(component, "ReferencedConfiguration")
                    if not part_path:
                        missing_path_count += 1
                        continue
                    
                    # Öffne Part für Dimensions-Abfrage
                    part_errors = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    part_warnings = win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
                    part_model = self.sw_app.OpenDoc6(
                        part_path,
                        1 if part_path.endswith(".SLDPRT") else 2,
                        0,
                        "",
                        part_errors,
                        part_warnings
                    )
                    
                    if part_model:
                        try:
                            # Lese Dimensionen
                            x_dim = 0
                            y_dim = 0
                            z_dim = 0
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
                            
                            # Lese Drawing-Pfad (TODO: Implementierung)
                            drawing_path = ""
                            
                            # Lese Custom Properties
                            properties = []
                            try:
                                # In SOLIDWORKS gibt es Config-spezifische UND globale Custom Properties.
                                # Viele Projekte nutzen die globalen Properties (CustomPropertyManager("")),
                                # daher lesen wir beide und mergen (Config überschreibt global).
                                props_by_name = {}
                                order = []

                                def _collect_from_mgr(mgr_name: str):
                                    mgr = part_model.Extension.CustomPropertyManager(mgr_name)
                                    # Some pywin32 bindings expose GetNames as a property (tuple) instead of a callable method.
                                    getnames = getattr(mgr, "GetNames", None)
                                    try:
                                        names = getnames() if callable(getnames) else getnames
                                    except Exception as _e_getnames:
                                        connector_logger.error(f"Fehler bei GetNames ({mgr_name}): {_e_getnames}", exc_info=True)
                                        names = []
                                    if names is None:
                                        names = []
                                    # Ensure iterable list of strings
                                    try:
                                        names_list = list(names)
                                    except Exception:
                                        names_list = []
                                    # Log counts for runtime evidence
                                    for pn in names_list:
                                        try:
                                            def _pick_str(x):
                                                if x is None:
                                                    return ""
                                                if isinstance(x, bool):
                                                    # Avoid treating COM success flags as values
                                                    return ""
                                                if isinstance(x, str):
                                                    return x
                                                if isinstance(x, (list, tuple)):
                                                    # common COM pattern: (status, value) or (value, resolved, ...)
                                                    if len(x) == 2 and isinstance(x[1], str):
                                                        return x[1]
                                                    for it in x:
                                                        if isinstance(it, str) and it:
                                                            return it
                                                    return ""
                                                return str(x)

                                            # Prefer Get2/Get4/Get5/Get6 (COM out-params differ across bindings).
                                            raw2 = raw4 = raw5 = raw6 = None
                                            err2 = err4 = err5 = err6 = None
                                            val = ""

                                            # 1) Get2 (simple)
                                            try:
                                                if hasattr(mgr, "Get2"):
                                                    try:
                                                        # Many COM bindings require the out-param to be passed as an argument
                                                        raw2 = mgr.Get2(str(pn), "")
                                                    except Exception:
                                                        raw2 = mgr.Get2(str(pn))
                                                    val = _pick_str(raw2)
                                            except Exception as _e2:
                                                err2 = f"{type(_e2).__name__}: {_e2}"
                                                raw2 = None

                                            # 2) Get4 (raw/resolved out-params)
                                            if not val:
                                                try:
                                                    if hasattr(mgr, "Get4"):
                                                        get4_raw_val = None
                                                        get4_res_val = None
                                                        try:
                                                            import pythoncom
                                                            import win32com.client
                                                            vt_bstr_byref = pythoncom.VT_BSTR | pythoncom.VT_BYREF
                                                            v_raw = win32com.client.VARIANT(vt_bstr_byref, "")
                                                            v_res = win32com.client.VARIANT(vt_bstr_byref, "")
                                                            raw4 = mgr.Get4(str(pn), False, v_raw, v_res)
                                                            # Prefer resolved if present
                                                            get4_res_val = getattr(v_res, "value", None)
                                                            get4_raw_val = getattr(v_raw, "value", None)
                                                            val = _pick_str(get4_res_val) or _pick_str(get4_raw_val)
                                                        except Exception:
                                                            # Fallback: older wrappers may return a tuple directly
                                                            raw4 = mgr.Get4(str(pn), False, "", "")
                                                            val = _pick_str(raw4)
                                                except Exception as _e4:
                                                    err4 = f"{type(_e4).__name__}: {_e4}"
                                                    raw4 = None

                                            # 3) Get5 (some versions)
                                            if not val:
                                                try:
                                                    if hasattr(mgr, "Get5"):
                                                        raw5 = mgr.Get5(str(pn), False)
                                                        val = _pick_str(raw5)
                                                except Exception as _e5:
                                                    err5 = f"{type(_e5).__name__}: {_e5}"
                                                    raw5 = None

                                            # 4) Get6 (raw/resolved/link out-params)
                                            if not val:
                                                try:
                                                    if hasattr(mgr, "Get6"):
                                                        get6_raw_val = None
                                                        get6_res_val = None
                                                        get6_link_val = None
                                                        try:
                                                            import pythoncom
                                                            import win32com.client
                                                            vt_bstr_byref = pythoncom.VT_BSTR | pythoncom.VT_BYREF
                                                            vt_bool_byref = pythoncom.VT_BOOL | pythoncom.VT_BYREF
                                                            v_raw = win32com.client.VARIANT(vt_bstr_byref, "")
                                                            v_res = win32com.client.VARIANT(vt_bstr_byref, "")
                                                            v_was = win32com.client.VARIANT(vt_bool_byref, False)
                                                            v_link = win32com.client.VARIANT(vt_bstr_byref, "")
                                                            raw6 = mgr.Get6(str(pn), False, v_raw, v_res, v_was, v_link)
                                                            get6_res_val = getattr(v_res, "value", None)
                                                            get6_raw_val = getattr(v_raw, "value", None)
                                                            get6_link_val = getattr(v_link, "value", None)
                                                            val = _pick_str(get6_res_val) or _pick_str(get6_raw_val)
                                                        except Exception:
                                                            raw6 = mgr.Get6(str(pn), False, "")
                                                            val = _pick_str(raw6)
                                                except Exception as _e6:
                                                    err6 = f"{type(_e6).__name__}: {_e6}"
                                                    raw6 = None

                                            name_str = str(pn)
                                            if name_str not in props_by_name:
                                                order.append(name_str)
                                            props_by_name[name_str] = str(val)
                                        except Exception as _e_prop:
                                            connector_logger.error(f"Fehler beim Lesen der Property '{pn}' ({mgr_name}): {_e_prop}", exc_info=True)

                                # 1) Global zuerst, dann Config-spezifisch überschreibt
                                _collect_from_mgr("")
                                if config_name:
                                    _collect_from_mgr(config_name)

                                for name_str in order:
                                    properties.append({"name": name_str, "value": props_by_name.get(name_str, "")})
                            except Exception as e:
                                connector_logger.error(f"Fehler beim Lesen der Properties: {e}", exc_info=True)
                            
                            # Füge Teil-Info hinzu
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
                                1 if is_hidden else 0  # [13] Exclude from Boom
                            ])
                            
                            # Füge Properties hinzu
                            for prop in properties:
                                results.append([
                                    child,
                                    part_name,
                                    config_name,
                                    None,
                                    prop["name"],  # [4] Property Name
                                    prop["value"],  # [5] Property Value
                                    None,
                                    x_dim,
                                    y_dim,
                                    z_dim,
                                    weight,
                                    part_path,
                                    drawing_path,
                                    1 if is_hidden else 0
                                ])
                            
                        finally:
                            self.sw_app.CloseDoc(part_path)
                    
                    child += 1
                else:
                    hidden_count += 1
        finally:
            self.sw_app.CloseDoc(assembly_filepath)
        
        return results
    
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
        if not self.sw_app:
            if not self.connect():
                return False
        
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
        sw_part = self.sw_app.OpenDoc6(
            sw_filepath_with_documentname,
            doc_type,
            0,  # swOpenDocOptions_Silent
            "",
            part_errors,
            part_warnings
        )
        
        if not sw_part:
            return False
        
        try:
            # Aktiviere Dokument
            self.sw_app.ActivateDoc(sw_filepath_with_documentname)
            
            # STEP-Datei erstellen
            if step:
                # Setze STEP-Export-Optionen (AP214)
                self.sw_app.SetUserPreferenceIntegerValue(214, 214)  # swStepAP = 214
                # Speichere als STEP
                sw_part.SaveAs2(f"{s_pathname}.stp", 0, True, False)
            
            # X_T-Datei erstellen
            if x_t:
                # Speichere als X_T
                sw_part.SaveAs2(f"{s_pathname}.x_t", 0, True, False)
            
            # STL-Datei erstellen
            if stl:
                # Speichere als STL
                sw_part.SaveAs2(f"{s_pathname}.stl", 0, True, False)
            
            return True
            
        finally:
            self.sw_app.CloseDoc(sw_filepath_with_documentname)

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
                self.sw_app.CloseDoc(sw_drawing_path)
            except Exception:
                # Best effort close
                pass

        return {"success": True, "created_files": created_files, "warnings": warnings}
