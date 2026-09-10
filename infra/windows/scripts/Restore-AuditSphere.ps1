[CmdletBinding()]
param(
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [Parameter(Mandatory = $true)][string]$DatabaseDump,
    [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $ConfirmRestore) { throw 'Restore changes production data. Re-run with -ConfirmRestore after incident approval.' }
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

foreach ($service in @('AuditSphere.Caddy', 'AuditSphere.Web', 'AuditSphere.Worker', 'AuditSphere.Api')) {
    $state = Get-Service -Name $service -ErrorAction SilentlyContinue
    if ($state -and $state.Status -ne 'Stopped') { throw "Stop $service before restore." }
}
if (-not (Test-Path -LiteralPath $DatabaseDump -PathType Leaf)) { throw "Dump not found: $DatabaseDump" }
& pg_restore.exe --list $DatabaseDump | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'The selected database dump is invalid.' }

$documentBackup = Join-Path $env:BACKUP_ROOT 'documents-current'
if (-not (Test-Path -LiteralPath $documentBackup -PathType Container)) { throw "Document backup not found: $documentBackup" }
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
if (Test-Path -LiteralPath $env:LOCAL_STORAGE_DIR) {
    $rollbackCopy = "$($env:LOCAL_STORAGE_DIR).pre-restore-$timestamp"
    Move-Item -LiteralPath $env:LOCAL_STORAGE_DIR -Destination $rollbackCopy
    Write-Host "Existing documents preserved at $rollbackCopy"
}
New-Item -ItemType Directory -Path $env:LOCAL_STORAGE_DIR -Force | Out-Null
& robocopy.exe $documentBackup $env:LOCAL_STORAGE_DIR /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:5 /FFT /XJ /NFL /NDL /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Document restore failed with Robocopy code $LASTEXITCODE." }

& pg_restore.exe --clean --if-exists --no-owner --dbname=$env:DATABASE_URL $DatabaseDump
if ($LASTEXITCODE -ne 0) { throw 'Database restore failed. Keep services stopped and escalate to the database owner.' }
Write-Host 'Restore completed. Run db:status, start services, Test-Deployment.ps1, and the UAT smoke test before reopening access.'

