[CmdletBinding()]
param(
    [string]$AppRoot = 'C:\AuditSphere\app',
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [Parameter(Mandatory = $true)][string]$TenantSlug,
    [Parameter(Mandatory = $true)][string]$TenantName,
    [Parameter(Mandatory = $true)][ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')][string]$AdminEmail,
    [Parameter(Mandatory = $true)][string]$AdminName,
    [string]$Currency = 'KES',
    [string]$Timezone = 'Africa/Nairobi'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

$secure = Read-Host 'Enter a unique temporary password (14+ characters)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
if ($password.Length -lt 14 -or $password -notmatch '[A-Z]' -or $password -notmatch '[a-z]' -or $password -notmatch '[0-9]') {
    throw 'Password must be 14+ characters and include uppercase, lowercase and a number.'
}

$env:BOOTSTRAP_TENANT_SLUG = $TenantSlug
$env:BOOTSTRAP_TENANT_NAME = $TenantName
$env:BOOTSTRAP_ADMIN_EMAIL = $AdminEmail.ToLowerInvariant()
$env:BOOTSTRAP_ADMIN_NAME = $AdminName
$env:BOOTSTRAP_ADMIN_PASSWORD = $password
$env:BOOTSTRAP_CURRENCY = $Currency
$env:BOOTSTRAP_TIMEZONE = $Timezone
try {
    Set-Location -LiteralPath $AppRoot
    & pnpm.cmd db:bootstrap-admin
    if ($LASTEXITCODE -ne 0) { throw 'Administrator bootstrap failed.' }
} finally {
    Remove-Item Env:\BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
}
Write-Host 'PASS: first administrator created. They must change the password and enrol MFA at first sign-in.'

