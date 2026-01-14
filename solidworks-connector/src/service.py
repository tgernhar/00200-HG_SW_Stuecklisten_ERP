"""
Windows Service Wrapper für SOLIDWORKS Connector
"""
import sys
import os

# Fix: Add pywin32 installation path to sys.path BEFORE any imports
# pywin32 may be installed in a different user's site-packages directory
# The service process runs under SYSTEM account, so we need to check multiple locations
# IMPORTANT: Check system-wide locations FIRST, as the service runs under SYSTEM account
pywin32_location = None
possible_paths = [
    # System-wide locations FIRST (service runs under SYSTEM account)
    r'C:\Program Files\Python314\Lib\site-packages',
    r'C:\Python314\Lib\site-packages',
    # Try to find Python installation directory
    os.path.join(os.path.dirname(sys.executable), 'Lib', 'site-packages'),
    # User-specific locations (for debug mode and command-line usage)
    r'C:\Users\tgernhar\AppData\Roaming\Python\Python314\site-packages',
    r'C:\Users\admin\AppData\Roaming\Python\Python314\site-packages',
    os.path.expanduser(r'~\AppData\Roaming\Python\Python314\site-packages'),
    # Check all user profiles
]
# Also check all user profiles in C:\Users
if os.path.exists(r'C:\Users'):
    try:
        for user_dir in os.listdir(r'C:\Users'):
            user_path = os.path.join(r'C:\Users', user_dir, r'AppData\Roaming\Python\Python314\site-packages')
            if os.path.exists(user_path):
                possible_paths.append(user_path)
    except Exception:
        pass

for path in possible_paths:
    if path and os.path.exists(path):
        win32serviceutil_path = os.path.join(path, 'win32', 'lib', 'win32serviceutil.py')
        if os.path.exists(win32serviceutil_path):
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
import win32event
import threading
import socket
import uvicorn

try:
    from main import app
except Exception as e:
    servicemanager.LogErrorMsg(f"Error importing main.app: {e}")
    raise


class SolidWorksConnectorService(win32serviceutil.ServiceFramework):
    _svc_name_ = "SolidWorksConnector"
    _svc_display_name_ = "SOLIDWORKS Connector Service"
    _svc_description_ = "REST API Service für SOLIDWORKS COM API Zugriff"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        socket.setdefaulttimeout(60)
        self.is_alive = True

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        self.is_alive = False

    def SvcDoRun(self):
        # CRITICAL: Report service as running IMMEDIATELY to avoid timeout
        self.ReportServiceStatus(win32service.SERVICE_RUNNING)
        
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        
        try:
            self.main()
        except Exception as e:
            servicemanager.LogErrorMsg(f"Error in service main: {e}")
            raise

    def main(self):
        # Starte FastAPI Server
        # Fix: sys.stdout is None in Windows Service context, so we need to disable
        # uvicorn's default logging configuration that tries to use sys.stdout.isatty()
        # We'll use access_log=False to disable access logging and log_config=None to use minimal logging
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8001,
            log_level="info",
            access_log=False,  # Disable access logging to avoid sys.stdout issues
            log_config=None  # Use minimal logging configuration
        )
        server = uvicorn.Server(config)
        
        # Run server in a separate thread to allow service to respond to stop events
        def run_server():
            try:
                server.run()
            except Exception as e:
                servicemanager.LogErrorMsg(f"Uvicorn server error: {e}")
                raise
        
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        
        # Wait for stop event
        while self.is_alive:
            result = win32event.WaitForSingleObject(self.stop_event, 1000)
            if result == win32event.WAIT_OBJECT_0:
                break
        
        # Shutdown server
        server.should_exit = True
        server_thread.join(timeout=5)


if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(SolidWorksConnectorService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(SolidWorksConnectorService)
