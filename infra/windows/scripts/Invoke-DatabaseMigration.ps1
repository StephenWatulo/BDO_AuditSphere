[CmdletBinding()]
param(
    [string]$AppRoot = 'C:\AuditSphere\app',
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [switch]$ConfirmProduction
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $ConfirmProduction) { throw 'Re-run with -ConfirmProduction after taking and verifying a database backup.' }
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile
Set-Location -LiteralPath $AppRoot
& pnpm.cmd db:status
if ($LASTEXITCODE -ne 0) { throw 'Could not read migration status.' }
& pnpm.cmd db:deploy
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Stop and follow the recovery runbook.' }
& pnpm.cmd db:status
if ($LASTEXITCODE -ne 0) { throw 'Post-migration status failed.' }
Write-Host 'PASS: production database migrations are applied.'

