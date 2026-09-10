[CmdletBinding()]
param(
    [string]$EnvFile = 'C:\AuditSphere\config\production.env',
    [string]$AppRoot = 'C:\AuditSphere\app'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile

$failed = New-Object Collections.Generic.List[string]
foreach ($service in @('AuditSphere.Api', 'AuditSphere.Worker', 'AuditSphere.Web', 'AuditSphere.Caddy')) {
    $state = Get-Service -Name $service -ErrorAction SilentlyContinue
    if (-not $state -or $state.Status -ne 'Running') { $failed.Add("Service is not running: $service") }
}

try {
    $health = Invoke-RestMethod -Uri "$($env:API_BASE_URL)/health" -TimeoutSec 20
    if ($health.status -ne 'ok') { $failed.Add('Public health endpoint did not return ok.') }
} catch { $failed.Add("Health request failed: $($_.Exception.Message)") }
try {
    $ready = Invoke-RestMethod -Uri "$($env:API_BASE_URL)/ready" -TimeoutSec 60
    if ($ready.status -ne 'ready' -or $ready.checks.database -ne 'up' -or $ready.checks.storage -ne 'up') { $failed.Add('Readiness endpoint is degraded.') }
} catch { $failed.Add("Readiness request failed: $($_.Exception.Message)") }
try {
    $signIn = Invoke-WebRequest -UseBasicParsing -Uri "$($env:WEB_BASE_URL)/sign-in" -TimeoutSec 20
    if ($signIn.StatusCode -ne 200) { $failed.Add('Sign-in page did not return HTTP 200.') }
    foreach ($header in @('Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options')) {
        if (-not $signIn.Headers[$header]) { $failed.Add("Missing security header: $header") }
    }
} catch { $failed.Add("Sign-in request failed: $($_.Exception.Message)") }

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$($env:API_BASE_URL)/api/docs" -TimeoutSec 10 -ErrorAction Stop | Out-Null
    $failed.Add('Swagger is reachable in production; it must be disabled.')
} catch {
    $response = $_.Exception.Response
    $statusCode = if ($response -and $response.StatusCode) { [int]$response.StatusCode } else { $null }
    if ($statusCode -notin @(404, 401, 403)) {
        $failed.Add("Could not confirm that Swagger is disabled: $($_.Exception.Message)")
    }
}

Set-Location -LiteralPath $AppRoot
& pnpm.cmd db:status
if ($LASTEXITCODE -ne 0) { $failed.Add('Prisma reports a migration problem.') }
$defender = Get-MpComputerStatus
if (-not $defender.AntivirusEnabled -or -not $defender.RealTimeProtectionEnabled -or $defender.AntivirusSignatureAge -gt 1) { $failed.Add('Microsoft Defender is not current and active.') }

if ($failed.Count) {
    $failed | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    throw "Deployment verification failed with $($failed.Count) issue(s)."
}
Write-Host "PASS: AuditSphere is healthy at $($env:WEB_BASE_URL). Complete the human UAT checklist before client data is allowed."
