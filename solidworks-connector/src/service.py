"""
Windows Service Wrapper für SOLIDWORKS Connector
"""
import sys
import os

# Fix: Add pywin32 installation path to sys.path BEFORE any imports
# pywin32 may be installed in a different user's site-packages directory
pywin32_location = None
possible_paths = [
    r'C:\Users\tgernhar\AppData\Roaming\Python\Python314\site-packages',
    r'C:\Users\admin\AppData\Roaming\Python\Python314\site-packages',
    os.path.expanduser(r'~\AppData\Roaming\Python\Python314\site-packages'),
]
for path in possible_paths:
    if os.path.exists(os.path.join(path, 'win32', 'lib', 'win32serviceutil.py')):
        pywin32_location = path
        break

if pywin32_location and pywin32_location not in sys.path:
    sys.path.insert(0, pywin32_location)
    # Also add pywin32_system32 for DLL files like _win32sysloader
    pywin32_system32_path = os.path.join(pywin32_location, 'pywin32_system32')
    if os.path.exists(pywin32_system32_path) and pywin32_system32_path not in sys.path:
        sys.path.insert(0, pywin32_system32_path)
    # Also add win32 directory itself (contains _win32sysloader.pyd)
    win32_path = os.path.join(pywin32_location, 'win32')
    if os.path.exists(win32_path) and win32_path not in sys.path:
        sys.path.insert(0, win32_path)
    # Also add win32/lib and win32/DLLs to sys.path for proper module resolution
    win32_lib_path = os.path.join(pywin32_location, 'win32', 'lib')
    win32_dlls_path = os.path.join(pywin32_location, 'win32', 'DLLs')
    if os.path.exists(win32_lib_path) and win32_lib_path not in sys.path:
        sys.path.insert(0, win32_lib_path)
    if os.path.exists(win32_dlls_path) and win32_dlls_path not in sys.path:
        sys.path.insert(0, win32_dlls_path)

# Clear any cached import attempts for win32 modules
for module_name in list(sys.modules.keys()):
    if module_name.startswith('win32') or module_name.startswith('pywin') or module_name.startswith('_win32'):
        del sys.modules[module_name]

# Import win32serviceutil - path should be in sys.path now
# First ensure win32 package is properly initialized
try:
    # Import win32 package first to ensure it's initialized
    import win32
except ImportError:
    pass  # win32 package might not be importable directly

import win32serviceutil
import win32service
import servicemanager
import socket
import uvicorn

# #region agent log
import json
log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
try:
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"G","location":"service.py:55","message":"Before importing main.app","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
except: pass
# #endregion
try:
    from main import app
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"H","location":"service.py:62","message":"main.app imported successfully","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        import traceback
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"I","location":"service.py:68","message":"Error importing main.app","data":{"error":str(e),"error_type":type(e).__name__,"traceback":traceback.format_exc()},"timestamp":int(__import__("time").time()*1000)}) + "\n")
    except: pass
    # #endregion
    raise


class SolidWorksConnectorService(win32serviceutil.ServiceFramework):
    _svc_name_ = "SolidWorksConnector"
    _svc_display_name_ = "SOLIDWORKS Connector Service"
    _svc_description_ = "REST API Service für SOLIDWORKS COM API Zugriff"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32service.CreateEvent(None, 0, 0, None)
        socket.setdefaulttimeout(60)
        self.is_alive = True

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        import win32event
        win32event.SetEvent(self.stop_event)
        self.is_alive = False

    def SvcDoRun(self):
        # #region agent log
        import json
        import traceback
        log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"A","location":"service.py:76","message":"SvcDoRun called","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"B","location":"service.py:85","message":"Service status logged, calling main()","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        try:
            self.main()
        except Exception as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"C","location":"service.py:91","message":"Error in main()","data":{"error":str(e),"error_type":type(e).__name__,"traceback":traceback.format_exc()},"timestamp":int(__import__("time").time()*1000)}) + "\n")
            except: pass
            # #endregion
            servicemanager.LogErrorMsg(f"Error in service main: {e}")
            raise

    def main(self):
        # #region agent log
        import json
        log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"D","location":"service.py:100","message":"main() called, creating uvicorn config","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        # Starte FastAPI Server
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8001,
            log_level="info"
        )
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"E","location":"service.py:110","message":"Uvicorn config created, creating server","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        server = uvicorn.Server(config)
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"service-start","hypothesisId":"F","location":"service.py:114","message":"Server created, calling server.run()","data":{},"timestamp":int(__import__("time").time()*1000)}) + "\n")
        except: pass
        # #endregion
        server.run()


if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(SolidWorksConnectorService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(SolidWorksConnectorService)
