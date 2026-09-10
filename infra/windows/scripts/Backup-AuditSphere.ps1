[CmdletBinding()]
param(
    [string]$EnvFile = 'C:\AuditSphere\config\backup.env'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

if ($env:BACKUP_ROOT -notmatch '^\\\\') { throw 'BACKUP_ROOT must be an off-server UNC path.' }
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$databaseRoot = Join-Path $env:BACKUP_ROOT 'database'
$documentBackup = Join-Path $env:BACKUP_ROOT 'documents-current'
New-Item -ItemType Directory -Path $databaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $documentBackup -Force | Out-Null

$dump = Join-Path $databaseRoot "auditsphere-$timestamp.dump"
& pg_dump.exe $env:BACKUP_DATABASE_URL --format=custom --compress=9 --file=$dump
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dump)) { throw 'PostgreSQL backup failed.' }
& pg_restore.exe --list $dump | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL backup verification failed.' }

& robocopy.exe $env:LOCAL_STORAGE_DIR $documentBackup /MIR /COPY:DAT /DCOPY:DAT /R:2 /W:5 /FFT /XJ /NFL /NDL /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Document backup failed with Robocopy code $LASTEXITCODE." }

$hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = Join-Path $databaseRoot "auditsphere-$timestamp.sha256.txt"
[IO.File]::WriteAllText($manifest, "$hash  $([IO.Path]::GetFileName($dump))`r`n", (New-Object Text.UTF8Encoding($false)))

$retention = [int]$env:BACKUP_RETENTION_DAYS
$cutoff = (Get-Date).ToUniversalTime().AddDays(-$retention)
Get-ChildItem -LiteralPath $databaseRoot -File | Where-Object { $_.LastWriteTimeUtc -lt $cutoff -and $_.Name -match '^auditsphere-\d{8}-\d{6}\.(dump|sha256\.txt)$' } | Remove-Item -Force

Write-Host "PASS: database dump verified at $dump and immutable documents mirrored to $documentBackup."
