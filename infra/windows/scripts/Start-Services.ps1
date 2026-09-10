[CmdletBinding()]
param([string]$RuntimeRoot = 'C:\AuditSphere')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
foreach ($service in @('Api', 'Worker', 'Web', 'Caddy')) {
    $wrapper = Join-Path $RuntimeRoot "services\AuditSphere.$service.exe"
    if (-not (Test-Path -LiteralPath $wrapper)) { throw "Service wrapper missing: $wrapper" }
    & $wrapper start
    if ($LASTEXITCODE -ne 0) { throw "Failed to start AuditSphere.$service" }
}
Get-Service -Name 'AuditSphere.*' | Format-Table Status, Name, DisplayName -AutoSize

