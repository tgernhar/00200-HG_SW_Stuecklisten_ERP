# Copy pywin32 modules to system-wide Python installation
# This script must be run as Administrator

$ErrorActionPreference = "Stop"

$source = "C:\Users\tgernhar\AppData\Roaming\Python\Python314\site-packages"
$dest = "C:\Program Files\Python314\Lib\site-packages"

Write-Host "Copying pywin32 modules from user installation to system-wide..."
Write-Host "Source: $source"
Write-Host "Destination: $dest"

if (-not (Test-Path $source)) {
    Write-Host "ERROR: Source directory does not exist: $source"
    exit 1
}

if (-not (Test-Path $dest)) {
    Write-Host "ERROR: Destination directory does not exist: $dest"
    exit 1
}

# Copy win32 directory
$win32Source = Join-Path $source "win32"
$win32Dest = Join-Path $dest "win32"
if (Test-Path $win32Source) {
    Write-Host "Copying win32 directory..."
    if (Test-Path $win32Dest) {
        Remove-Item $win32Dest -Recurse -Force
    }
    Copy-Item -Path $win32Source -Destination $win32Dest -Recurse -Force
    Write-Host "  Copied win32 directory"
} else {
    Write-Host "WARNING: win32 directory not found at $win32Source"
}

# Copy pywin32_system32 directory
$pywin32System32Source = Join-Path $source "pywin32_system32"
$pywin32System32Dest = Join-Path $dest "pywin32_system32"
if (Test-Path $pywin32System32Source) {
    Write-Host "Copying pywin32_system32 directory..."
    if (Test-Path $pywin32System32Dest) {
        Remove-Item $pywin32System32Dest -Recurse -Force
    }
    Copy-Item -Path $pywin32System32Source -Destination $pywin32System32Dest -Recurse -Force
    Write-Host "  Copied pywin32_system32 directory"
} else {
    Write-Host "WARNING: pywin32_system32 directory not found at $pywin32System32Source"
}

# Copy pywintypes*.pyd files
Write-Host "Copying pywintypes*.pyd files..."
Get-ChildItem -Path $source -Filter "pywintypes*.pyd" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dest -Force
    Write-Host "  Copied $($_.Name)"
}

# Copy pythoncom*.pyd files
Write-Host "Copying pythoncom*.pyd files..."
Get-ChildItem -Path $source -Filter "pythoncom*.pyd" | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dest -Force
    Write-Host "  Copied $($_.Name)"
}

# Verify installation
$win32ServiceUtil = Join-Path $dest "win32\lib\win32serviceutil.py"
if (Test-Path $win32ServiceUtil) {
    Write-Host ""
    Write-Host "SUCCESS: pywin32 modules copied successfully!"
    Write-Host "  Verified: $win32ServiceUtil exists"
} else {
    Write-Host ""
    Write-Host "ERROR: Verification failed - $win32ServiceUtil does not exist"
    exit 1
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Run: python C:\Program Files\Python314\Scripts\pywin32_postinstall.py -install"
Write-Host "2. Restart the service: python src/service.py start"
