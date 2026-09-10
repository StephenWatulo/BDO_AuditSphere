[CmdletBinding()]
param(
    [string]$AppRoot = 'C:\AuditSphere\app',
    [string]$RuntimeRoot = 'C:\AuditSphere',
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [Parameter(Mandatory = $true)]
    [string]$WinSwPath,
    [Parameter(Mandatory = $true)]
    [string]$CaddyPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run as Administrator.' }

foreach ($file in @($WinSwPath, $CaddyPath, $EnvFile, (Join-Path $AppRoot 'package.json'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file not found: $file" }
}
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

$serviceRoot = Join-Path $RuntimeRoot 'services'
$logRoot = Join-Path $RuntimeRoot 'logs'
$binRoot = Join-Path $RuntimeRoot 'bin'
$caddyRoot = Join-Path $RuntimeRoot 'caddy'
foreach ($directory in @($serviceRoot, $logRoot, $binRoot, $caddyRoot, $env:LOCAL_STORAGE_DIR)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

Copy-Item -LiteralPath $CaddyPath -Destination (Join-Path $binRoot 'caddy.exe') -Force
Copy-Item -LiteralPath (Join-Path $AppRoot 'infra\windows\Caddyfile') -Destination (Join-Path $caddyRoot 'Caddyfile') -Force

$runner = Join-Path $AppRoot 'infra\windows\scripts\Run-Service.ps1'
$templates = Join-Path $AppRoot 'infra\windows\services'
$services = @('Api', 'Worker', 'Web', 'Caddy')
foreach ($service in $services) {
    $base = "AuditSphere.$service"
    $executable = Join-Path $serviceRoot "$base.exe"
    $configuration = Join-Path $serviceRoot "$base.xml"
    Copy-Item -LiteralPath $WinSwPath -Destination $executable -Force
    $xml = Get-Content -LiteralPath (Join-Path $templates "$base.xml") -Raw -Encoding UTF8
    $xml = $xml.Replace('__RUNNER__', $runner).Replace('__APP_ROOT__', $AppRoot).Replace('__ENV_FILE__', $EnvFile).Replace('__RUNTIME_ROOT__', $RuntimeRoot).Replace('__LOG_ROOT__', $logRoot)
    [IO.File]::WriteAllText($configuration, $xml, (New-Object Text.UTF8Encoding($false)))
    Unblock-File -LiteralPath $executable -ErrorAction SilentlyContinue
    Unblock-File -LiteralPath $runner -ErrorAction SilentlyContinue
}

# The app binaries are read-only to LocalService; logs, Caddy state and document
# storage are writable. The secret file is readable only by admins, SYSTEM and
# the runtime identity.
& icacls.exe $AppRoot /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' 'LOCAL SERVICE:(OI)(CI)RX' /T /C | Out-Null
& icacls.exe $EnvFile /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' 'LOCAL SERVICE:R' | Out-Null
foreach ($directory in @($logRoot, $caddyRoot, $env:LOCAL_STORAGE_DIR)) {
    & icacls.exe $directory /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' 'LOCAL SERVICE:(OI)(CI)M' /T /C | Out-Null
}

foreach ($service in $services) {
    $wrapper = Join-Path $serviceRoot "AuditSphere.$service.exe"
    & $wrapper install
    if ($LASTEXITCODE -ne 0) { throw "Failed to install AuditSphere.$service" }
}

New-NetFirewallRule -DisplayName 'AuditSphere HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Domain,Private | Out-Null
New-NetFirewallRule -DisplayName 'AuditSphere ACME HTTP' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Domain,Private | Out-Null

Write-Host 'Services installed but not started. Run migrations and bootstrap the first administrator before Start-Services.ps1.'

