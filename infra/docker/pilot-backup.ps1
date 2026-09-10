<#
.SYNOPSIS
  Nightly backup for the AuditSphere pilot stack (Docker Compose on Windows).

.DESCRIPTION
  1. Dumps the PostgreSQL database from the running container (pg_dump custom format).
  2. Mirrors the uploaded-documents folder (PILOT_DATA_DIR\storage) with robocopy.
  3. Keeps the last 14 daily dumps.

  Run manually from PowerShell, or schedule it (see docs/pilot-runbook.md, section 9):
    powershell -ExecutionPolicy Bypass -File D:\auditsphere-data\pilot-backup.ps1

.PARAMETER DataDir
  Same value as PILOT_DATA_DIR in .env (default D:\auditsphere-data).

.PARAMETER BackupDir
  Where dumps and the documents mirror go. Choose a different disk or a synced
  folder for off-machine copies (default $DataDir\backups).
#>
param(
  [string]$DataDir   = "D:\auditsphere-data",
  [string]$BackupDir = "",
  [string]$Container = "auditsphere-postgres-1",
  [string]$DbUser    = "auditsphere",
  [string]$DbName    = "auditsphere",
  [int]$KeepDays     = 14
)

$ErrorActionPreference = "Stop"
if (-not $BackupDir) { $BackupDir = Join-Path $DataDir "backups" }
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$log = Join-Path $BackupDir "backup.log"

function Log($msg) { $line = "$(Get-Date -Format s) $msg"; Write-Host $line; Add-Content -Path $log -Value $line }

try {
  # 1. Database dump (custom format, restorable with pg_restore)
  $dump = Join-Path $BackupDir "auditsphere-$stamp.dump"
  Log "Dumping database $DbName from container $Container to $dump"
  # Dump inside the container, then copy the file out (binary-safe; no console piping).
  & docker exec $Container pg_dump -U $DbUser -Fc -f /tmp/auditsphere.dump $DbName
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
  & docker cp "${Container}:/tmp/auditsphere.dump" $dump
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }
  & docker exec $Container rm -f /tmp/auditsphere.dump
  Log ("Dump size: {0:N1} MB" -f ((Get-Item $dump).Length / 1MB))

  # 2. Documents mirror
  $src = Join-Path $DataDir "storage"
  $dst = Join-Path $BackupDir "storage-mirror"
  if (Test-Path $src) {
    Log "Mirroring $src to $dst"
    & robocopy $src $dst /MIR /R:2 /W:5 /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
  } else {
    Log "No storage folder at $src (nothing uploaded yet)"
  }

  # 3. Retention
  Get-ChildItem $BackupDir -Filter "auditsphere-*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    ForEach-Object { Log "Removing old dump $($_.Name)"; Remove-Item $_.FullName }

  Log "Backup finished OK"
  exit 0
}
catch {
  Log "BACKUP FAILED: $($_.Exception.Message)"
  exit 1
}
