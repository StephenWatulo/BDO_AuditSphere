[CmdletBinding()]
param(
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [string]$BackupEnvFile = 'C:\AuditSphere\config\backup.env',
    [string]$PostgresAdminUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

$uri = [Uri]$env:DATABASE_URL
$userInfo = [Uri]::UnescapeDataString($uri.UserInfo).Split(':', 2)
if ($userInfo.Count -ne 2 -or $userInfo[0] -ne 'auditsphere_owner') { throw 'DATABASE_URL must use the auditsphere_owner role.' }
$databasePassword = $userInfo[1]
$databaseName = $uri.AbsolutePath.Trim('/')
if ($databaseName -ne 'auditsphere') { throw 'DATABASE_URL must target the auditsphere database.' }
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $BackupEnvFile
$backupUri = [Uri]$env:BACKUP_DATABASE_URL
$backupUserInfo = [Uri]::UnescapeDataString($backupUri.UserInfo).Split(':', 2)
if ($backupUserInfo.Count -ne 2 -or $backupUserInfo[0] -ne 'auditsphere_backup') { throw 'BACKUP_DATABASE_URL must use the auditsphere_backup role.' }
$backupDatabasePassword = $backupUserInfo[1]

$secure = Read-Host "Enter the PostgreSQL $PostgresAdminUser password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }

$sql = @"
\set ON_ERROR_STOP on
\set role_password '$databasePassword'
\set backup_password '$backupDatabasePassword'
SELECT format('CREATE ROLE auditsphere_owner LOGIN PASSWORD %L', :'role_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditsphere_owner')
\gexec
ALTER ROLE auditsphere_owner LOGIN PASSWORD :'role_password';
SELECT 'CREATE DATABASE auditsphere OWNER auditsphere_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auditsphere')
\gexec
ALTER DATABASE auditsphere OWNER TO auditsphere_owner;
SELECT format('CREATE ROLE auditsphere_backup LOGIN PASSWORD %L', :'backup_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditsphere_backup')
\gexec
ALTER ROLE auditsphere_backup LOGIN PASSWORD :'backup_password';
GRANT CONNECT ON DATABASE auditsphere TO auditsphere_backup;
\connect auditsphere
GRANT USAGE ON SCHEMA public TO auditsphere_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO auditsphere_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO auditsphere_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE auditsphere_owner IN SCHEMA public GRANT SELECT ON TABLES TO auditsphere_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE auditsphere_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO auditsphere_backup;
"@

try {
    $sql | & psql.exe -h 127.0.0.1 -U $PostgresAdminUser -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    $databasePassword = $null
    $backupDatabasePassword = $null
    $sql = $null
}
Write-Host 'PASS: database owner, database and read-only backup role exist. PostgreSQL must remain bound to localhost only.'
