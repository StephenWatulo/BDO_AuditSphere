[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Api', 'Worker', 'Web', 'Caddy')]
    [string]$Service,
    [Parameter(Mandatory = $true)]
    [string]$AppRoot,
    [Parameter(Mandatory = $true)]
    [string]$EnvFile,
    [string]$RuntimeRoot = 'C:\AuditSphere'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile
Set-Location -LiteralPath $AppRoot

switch ($Service) {
    'Api' {
        $env:API_HOST = '127.0.0.1'
        $env:RUN_JOBS = 'false'
        & pnpm.cmd --filter '@auditsphere/api' start
    }
    'Worker' {
        $env:API_HOST = '127.0.0.1'
        $env:API_PORT = '4001'
        $env:RUN_JOBS = 'true'
        & pnpm.cmd --filter '@auditsphere/api' start:worker
    }
    'Web' {
        $env:PORT = '3000'
        $env:HOSTNAME = '127.0.0.1'
        $env:API_INTERNAL_URL = 'http://127.0.0.1:4000'
        & pnpm.cmd --filter '@auditsphere/web' start
    }
    'Caddy' {
        $caddy = Join-Path $RuntimeRoot 'bin\caddy.exe'
        $config = Join-Path $RuntimeRoot 'caddy\Caddyfile'
        & $caddy run --config $config --adapter caddyfile
    }
}

exit $LASTEXITCODE

