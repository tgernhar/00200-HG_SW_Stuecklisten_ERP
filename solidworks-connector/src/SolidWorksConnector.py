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
            # Debug: Direktes File-Write zum Testen
            import datetime
            connector_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_file = os.path.join(connector_dir, 'logs', f'solidworks_connector_{datetime.datetime.now().strftime("%Y%m%d")}.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Versuche Verbindung zu SOLIDWORKS herzustellen...\n")
            
            # COM initialization is required in the current thread before any win32com calls.
            # Runtime evidence: (-2147221008, 'CoInitialize wurde nicht aufgerufen.')
            try:
                pythoncom.CoInitialize()
                self._com_initialized = True
            except Exception as ci_err:
                # Still proceed to log and fail clearly if Dispatch fails
                with open(log_file, 'a', encoding='utf-8') as f:
                    f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - CoInitialize failed: {ci_err}\n")

            self._owner_thread_id = threading.get_ident()
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Thread ident: {self._owner_thread_id}\n")
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - PID: {os.getpid()} USER: {getpass.getuser()}\n")
                f.flush()

            connector_logger.info("Versuche Verbindung zu SOLIDWORKS herzustellen...")
            # Prefer attaching to an already running instance (common in user workflows).
            # If that fails, fall back to creating a new instance.
            connected_via = None
            try:
                self.sw_app = win32com.client.GetActiveObject("SldWorks.Application")
                connected_via = "GetActiveObject"
            except Exception:
                # Create a new instance in the local server context
                self.sw_app = win32com.client.DispatchEx("SldWorks.Application", clsctx=pythoncom.CLSCTX_LOCAL_SERVER)
                connected_via = "DispatchEx(CLSCTX_LOCAL_SERVER)"

            self.sw_app.Visible = False
            
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE SUCCESS - Erfolgreich zu SOLIDWORKS verbunden\n")
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE SUCCESS - Connected via: {connected_via}\n")
                f.flush()
            connector_logger.info("Erfolgreich zu SOLIDWORKS verbunden")
            return True
        except pywintypes.com_error as e:
            import datetime
            connector_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_file = os.path.join(connector_dir, 'logs', f'solidworks_connector_{datetime.datetime.now().strftime("%Y%m%d")}.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - COM error connecting to SOLIDWORKS: {e}\n")
                try:
                    f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - COM hresult: {getattr(e, 'hresult', None)}\n")
                    f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - COM excepinfo: {getattr(e, 'excepinfo', None)}\n")
                except Exception:
                    pass
                import traceback
                f.write(traceback.format_exc() + "\n")
                f.flush()
            connector_logger.error(f"COM Fehler beim Verbinden zu SOLIDWORKS: {e}", exc_info=True)
            return False
        except Exception as e:
            import datetime
            connector_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_file = os.path.join(connector_dir, 'logs', f'solidworks_connector_{datetime.datetime.now().strftime("%Y%m%d")}.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - Fehler beim Verbinden zu SOLIDWORKS: {e}\n")
                import traceback
                f.write(f"Traceback: {traceback.format_exc()}\n")
                f.flush()
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
        # Debug: Direktes File-Write zum Testen
        import datetime
        try:
            connector_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_file = os.path.join(connector_dir, 'logs', f'solidworks_connector_{datetime.datetime.now().strftime("%Y%m%d")}.log')
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - get_all_parts_and_properties_from_assembly aufgerufen mit: {assembly_filepath}\n")
                f.flush()  # Stelle sicher, dass die Daten sofort geschrieben werden
        except Exception as write_error:
            # Falls File-Write fehlschlägt, logge es
            connector_logger.error(f"Fehler beim File-Write: {write_error}", exc_info=True)
        
        connector_logger.info(f"get_all_parts_and_properties_from_assembly aufgerufen mit: {assembly_filepath}")
        
        if not self.sw_app:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - SOLIDWORKS-Verbindung nicht vorhanden, versuche Verbindung...\n")
            connector_logger.info("SOLIDWORKS-Verbindung nicht vorhanden, versuche Verbindung...")
            if not self.connect():
                with open(log_file, 'a', encoding='utf-8') as f:
                    f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - Konnte nicht zu SOLIDWORKS verbinden\n")
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
        sw_model = self.sw_app.OpenDoc6(
            assembly_filepath,
            3,  # swDocASSEMBLY
            0,  # swOpenDocOptions_Silent
            "",
            0,
            0
        )
        
        if not sw_model:
            raise Exception(f"Konnte Assembly nicht öffnen: {assembly_filepath}")
        
        results = []
        child = 0
        
        try:
            # Traversiere Teilebaum
            components = sw_model.GetComponents(True)  # True = alle Ebenen
            
            for component in components:
                # Prüfe ob Teil versteckt ist
                is_hidden = component.IsSuppressed() or component.IsEnvelope()
                
                if not is_hidden:
                    # Lese Part/Assembly
                    part_path = component.GetPathName()
                    part_name = component.Name2
                    config_name = component.ReferencedConfiguration
                    
                    # Öffne Part für Dimensions-Abfrage
                    part_model = self.sw_app.OpenDoc6(
                        part_path,
                        1 if part_path.endswith(".SLDPRT") else 3,
                        0,
                        "",
                        0,
                        0
                    )
                    
                    if part_model:
                        try:
                            # Lese Dimensionen
                            box = part_model.GetPartBox(True)
                            x_dim = box[3] - box[0] if box else 0
                            y_dim = box[4] - box[1] if box else 0
                            z_dim = box[5] - box[2] if box else 0
                            
                            # Lese Gewicht
                            mass_props = part_model.GetMassProperties2(0)
                            weight = mass_props[0] if mass_props else 0
                            
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
        doc_type = 1 if sw_filepath_with_documentname.endswith(".SLDPRT") else 3  # swDocPART oder swDocASSEMBLY
        
        # Öffne Dokument
        sw_part = self.sw_app.OpenDoc6(
            sw_filepath_with_documentname,
            doc_type,
            0,  # swOpenDocOptions_Silent
            "",
            0,
            0
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
