# Install all dependencies system-wide for the Windows Service
# This script must be run as Administrator

$ErrorActionPreference = "Stop"

$pythonExe = "C:\Program Files\Python314\python.exe"
$sitePackages = "C:\Program Files\Python314\Lib\site-packages"

Write-Host "Installing dependencies system-wide..."
Write-Host "Python: $pythonExe"
Write-Host "Target: $sitePackages"

if (-not (Test-Path $pythonExe)) {
    Write-Host "ERROR: Python not found at $pythonExe"
    exit 1
}

if (-not (Test-Path $sitePackages)) {
    Write-Host "ERROR: Site-packages directory does not exist: $sitePackages"
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "Installing fastapi==0.104.1..."
& $pythonExe -m pip install --target $sitePackages fastapi==0.104.1

Write-Host ""
Write-Host "Installing uvicorn[standard]==0.24.0..."
& $pythonExe -m pip install --target $sitePackages "uvicorn[standard]==0.24.0"

Write-Host ""
Write-Host "Installing pydantic==2.5.0..."
& $pythonExe -m pip install --target $sitePackages pydantic==2.5.0

Write-Host ""
Write-Host "Verifying installation..."

# Verify installations
$packages = @("fastapi", "uvicorn", "pydantic")
foreach ($package in $packages) {
    $packagePath = Join-Path $sitePackages $package
    if (Test-Path $packagePath) {
        Write-Host "  [OK] $package installed"
    } else {
        Write-Host "  [FAIL] $package NOT found"
    }
}

Write-Host ""
Write-Host "Done! All dependencies installed system-wide."
