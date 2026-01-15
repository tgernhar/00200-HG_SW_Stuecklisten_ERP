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
            components = sw_model.GetComponents(True)  # True = alle Ebenen
            
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
                            box = part_model.GetPartBox(True)
                            x_dim = box[3] - box[0] if box else 0
                            y_dim = box[4] - box[1] if box else 0
                            z_dim = box[5] - box[2] if box else 0
                            
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
                                custom_props = part_model.Extension.CustomPropertyManager(config_name)
                                prop_names = custom_props.GetNames()
                                
                                for prop_name in prop_names:
                                    prop_value = custom_props.Get6(prop_name, False, "")[1]
                                    properties.append({
                                        "name": prop_name,
                                        "value": prop_value
                                    })
                            except Exception as e:
                                print(f"Fehler beim Lesen der Properties: {e}")
                            
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
