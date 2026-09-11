[CmdletBinding()]
param(
    [string]$AppRoot = 'C:\AuditSphere\app',
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [string]$BackupEnvFile = 'C:\AuditSphere\config\backup.env',
    [switch]$BeforeServiceInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$failures = New-Object Collections.Generic.List[string]

function Fail([string]$Message) { $script:failures.Add($Message) }
function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { Fail "Required command not found: $Name" }
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Fail 'Run this script in an elevated PowerShell session.' }

if (-not (Test-Path -LiteralPath $AppRoot -PathType Container)) { Fail "Application root not found: $AppRoot" }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { Fail "Environment file not found: $EnvFile" }
else { & (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile }
if (-not (Test-Path -LiteralPath $BackupEnvFile -PathType Leaf)) { Fail "Backup environment file not found: $BackupEnvFile" }

$os = Get-CimInstance Win32_OperatingSystem
if ($os.Caption -notmatch 'Windows Server (2022|2025)') { Fail "Use Windows Server 2022 or 2025; detected: $($os.Caption)" }
$ramGiB = [Math]::Round(($os.TotalVisibleMemorySize * 1KB) / 1GB, 1)
if ($ramGiB -lt 16) { Fail "At least 16 GiB RAM is required for the single-server launch; detected $ramGiB GiB." }
$cpu = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
if ($cpu -lt 4) { Fail "At least 4 logical CPUs are required; detected $cpu." }

foreach ($command in @('node.exe', 'pnpm.cmd', 'psql.exe', 'pg_dump.exe', 'pg_restore.exe')) { Require-Command $command }
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($node) {
    $major = [int]((& node.exe --version).TrimStart('v').Split('.')[0])
    if ($major -lt 20) { Fail "Node.js 20 or newer is required; detected $(& node.exe --version)." }
}

if (Test-Path -LiteralPath $EnvFile) {
    $required = @('DATABASE_URL', 'API_BASE_URL', 'WEB_BASE_URL', 'CORS_ORIGINS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'LOCAL_STORAGE_DIR', 'DOMAIN', 'ACME_EMAIL', 'BACKUP_ROOT')
    foreach ($key in $required) {
        $value = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ([string]::IsNullOrWhiteSpace($value)) { Fail "Missing required environment value: $key" }
    }
    foreach ($key in @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS')) {
        $value = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($value -match 'CHANGE_ME') { Fail "$key still contains CHANGE_ME." }
    }
    if ($env:API_BASE_URL -notmatch '^https://') { Fail 'API_BASE_URL must use HTTPS.' }
    if ($env:WEB_BASE_URL -notmatch '^https://') { Fail 'WEB_BASE_URL must use HTTPS.' }
    if ($env:COOKIE_SECURE -ne 'true') { Fail 'COOKIE_SECURE must be true.' }
    if ($env:MFA_ENFORCEMENT -ne 'all') { Fail 'MFA_ENFORCEMENT must be all for local-account production.' }
    if ($env:MALWARE_SCAN_REQUIRED -ne 'true' -or $env:MALWARE_SCANNER -ne 'defender') { Fail 'Windows production must fail closed with the Defender scanner.' }
    if (Test-Path -LiteralPath $BackupEnvFile) {
        & (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $BackupEnvFile
        if ($env:BACKUP_DATABASE_URL -notmatch '^postgresql://auditsphere_backup:') { Fail 'BACKUP_DATABASE_URL must use the read-only auditsphere_backup role.' }
        if ($env:BACKUP_DATABASE_URL -match 'CHANGE_ME') { Fail 'BACKUP_DATABASE_URL still contains CHANGE_ME.' }
    }
    if ($env:BACKUP_ROOT -notmatch '^\\\\') { Fail 'BACKUP_ROOT must be an off-server UNC path, not a local disk.' }
    elseif (-not ([IO.Directory]::Exists($env:BACKUP_ROOT))) { Fail "Backup share is not reachable: $($env:BACKUP_ROOT)" }
    else {
        $probe = Join-Path $env:BACKUP_ROOT (".auditsphere-write-test-{0}.tmp" -f [Guid]::NewGuid())
        try { [IO.File]::WriteAllText($probe, 'backup write test'); Remove-Item -LiteralPath $probe -Force }
        catch { Fail "Backup share is not writable by this account: $($_.Exception.Message)" }
    }
    try {
        $addresses = @(Resolve-DnsName -Name $env:DOMAIN -Type A -ErrorAction Stop | Where-Object Type -eq 'A')
        if (-not $addresses.Count) { Fail "DOMAIN has no DNS A record: $($env:DOMAIN)" }
    } catch { Fail "DOMAIN cannot be resolved: $($env:DOMAIN)" }
    if (-not (Test-NetConnection -ComputerName $env:SMTP_HOST -Port ([int]$env:SMTP_PORT) -InformationLevel Quiet)) {
        Fail "SMTP relay is not reachable at $($env:SMTP_HOST):$($env:SMTP_PORT)"
    }
    $driveName = Split-Path -Qualifier $env:LOCAL_STORAGE_DIR
    if ($driveName) {
        $drive = Get-PSDrive -Name $driveName.TrimEnd(':') -ErrorAction SilentlyContinue
        if (-not $drive) { Fail "Document data drive does not exist: $driveName" }
        elseif ($drive.Free -lt 50GB) { Fail "Document data drive has less than 50 GiB free: $driveName" }
    }
}

$defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
if (-not $defender -or -not $defender.AntivirusEnabled -or -not $defender.RealTimeProtectionEnabled) { Fail 'Microsoft Defender Antivirus and real-time protection must be active.' }
elseif ($defender.AntivirusSignatureAge -gt 1) { Fail "Defender signatures are older than one day (age: $($defender.AntivirusSignatureAge))." }

if (-not $BeforeServiceInstall) {
    foreach ($name in @('postgresql*', 'AuditSphere.Api', 'AuditSphere.Worker', 'AuditSphere.Web', 'AuditSphere.Caddy')) {
        if (-not (Get-Service -Name $name -ErrorAction SilentlyContinue)) { Fail "Expected Windows service not found: $name" }
    }
    foreach ($port in @(3000, 4000, 5432)) {
        $publicListener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }
        if ($publicListener) { Fail "Backend port $port is listening beyond localhost." }
    }
}

if ($failures.Count) {
    $failures | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    throw "Preflight failed with $($failures.Count) blocking issue(s). Do not launch."
}

Write-Host "PASS: Windows production preflight completed on $($os.Caption), $cpu CPUs, $ramGiB GiB RAM."
