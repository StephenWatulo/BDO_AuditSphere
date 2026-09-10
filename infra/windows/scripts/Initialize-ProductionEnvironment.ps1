[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9.-]+[A-Za-z0-9]$')]
    [string]$Domain,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')]
    [string]$AcmeEmail,
    [string]$OutputFile = 'C:\AuditSphere\config\production.env',
    [string]$BackupEnvironmentFile = 'C:\AuditSphere\config\backup.env',
    [string]$DocumentRoot = 'D:\AuditSphereData\documents',
    [string]$BackupRoot = '\\backup-server\auditsphere-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function New-RandomBytes([int]$Count) {
    $bytes = New-Object byte[] $Count
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return $bytes
}

function New-Base64UrlSecret([int]$Count = 48) {
    return [Convert]::ToBase64String((New-RandomBytes $Count)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-HexSecret([int]$Count = 32) {
    return ([BitConverter]::ToString((New-RandomBytes $Count))).Replace('-', '').ToLowerInvariant()
}

if (Test-Path -LiteralPath $OutputFile) { throw "Refusing to overwrite existing environment file: $OutputFile" }
if (Test-Path -LiteralPath $BackupEnvironmentFile) { throw "Refusing to overwrite existing backup environment file: $BackupEnvironmentFile" }
$parent = Split-Path -Parent $OutputFile
New-Item -ItemType Directory -Path $parent -Force | Out-Null

$databasePassword = New-HexSecret 24
$backupDatabasePassword = New-HexSecret 24
$lines = @(
    'NODE_ENV=production',
    'LOG_LEVEL=info',
    "DATABASE_URL=postgresql://auditsphere_owner:$databasePassword@127.0.0.1:5432/auditsphere?schema=public&connection_limit=20",
    'API_PORT=4000',
    'SWAGGER_ENABLED=false',
    "API_BASE_URL=https://$Domain",
    "WEB_BASE_URL=https://$Domain",
    "CORS_ORIGINS=https://$Domain",
    "JWT_ACCESS_SECRET=$(New-Base64UrlSecret)",
    "JWT_REFRESH_SECRET=$(New-Base64UrlSecret)",
    'JWT_ACCESS_TTL=15m',
    'JWT_REFRESH_TTL=12h',
    'COOKIE_SECURE=true',
    'MFA_ENFORCEMENT=all',
    "ENCRYPTION_KEY=$(New-HexSecret 32)",
    'RUN_JOBS=false',
    'ENTRA_TENANT_ID=',
    'ENTRA_CLIENT_ID=',
    'ENTRA_CLIENT_SECRET=',
    "ENTRA_REDIRECT_URI=https://$Domain/api/v1/auth/entra/callback",
    'STORAGE_DRIVER=local',
    "LOCAL_STORAGE_DIR=$DocumentRoot",
    'S3_ENDPOINT=',
    'S3_REGION=us-east-1',
    'S3_BUCKET=auditsphere-documents',
    'S3_ACCESS_KEY=',
    'S3_SECRET_KEY=',
    'S3_FORCE_PATH_STYLE=true',
    'MALWARE_SCAN_REQUIRED=true',
    'MALWARE_SCANNER=defender',
    'CLAMAV_HOST=',
    'CLAMAV_PORT=3310',
    'CLAMAV_TIMEOUT_MS=120000',
    'DEFENDER_MPCMDRUN_PATH=',
    'AI_ENABLED=false',
    'AI_BASE_URL=',
    'AI_API_KEY=',
    'AI_MODEL=',
    'SMTP_HOST=CHANGE_ME_REQUIRED_SMTP_HOST',
    'SMTP_PORT=587',
    'SMTP_USER=CHANGE_ME_REQUIRED_SMTP_USER',
    'SMTP_PASS=CHANGE_ME_REQUIRED_SMTP_PASSWORD',
    "SMTP_FROM=BDO AuditSphere <no-reply@$Domain>",
    "DOMAIN=$Domain",
    "ACME_EMAIL=$AcmeEmail",
    'API_INTERNAL_URL=http://127.0.0.1:4000',
    'PORT=3000',
    'HOSTNAME=127.0.0.1',
    "BACKUP_ROOT=$BackupRoot",
    'BACKUP_RETENTION_DAYS=35'
)

[IO.File]::WriteAllLines($OutputFile, $lines, (New-Object Text.UTF8Encoding($false)))
& icacls.exe $OutputFile /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' | Out-Null

$backupParent = Split-Path -Parent $BackupEnvironmentFile
New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
$backupLines = @(
    "BACKUP_DATABASE_URL=postgresql://auditsphere_backup:$backupDatabasePassword@127.0.0.1:5432/auditsphere",
    "LOCAL_STORAGE_DIR=$DocumentRoot",
    "BACKUP_ROOT=$BackupRoot",
    'BACKUP_RETENTION_DAYS=35'
)
[IO.File]::WriteAllLines($BackupEnvironmentFile, $backupLines, (New-Object Text.UTF8Encoding($false)))
& icacls.exe $BackupEnvironmentFile /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' | Out-Null

Write-Host "Created protected environment file: $OutputFile"
Write-Host "Created separate protected backup environment: $BackupEnvironmentFile"
Write-Host 'Next: replace the three CHANGE_ME SMTP values, escrow the file securely, and run Preflight.ps1.'
Write-Host 'Database passwords are embedded only in their protected URLs. Initialize-Database.ps1 creates the owner and read-only backup roles.'
