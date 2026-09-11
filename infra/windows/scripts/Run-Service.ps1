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
$NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source

switch ($Service) {
    'Api' {
        $env:API_HOST = '127.0.0.1'
        $env:RUN_JOBS = 'false'
        & $NodeExecutable (Join-Path $AppRoot 'apps\api\dist\main.js')
    }
    'Worker' {
        $env:API_HOST = '127.0.0.1'
        $env:API_PORT = '4001'
        $env:RUN_JOBS = 'true'
        & $NodeExecutable (Join-Path $AppRoot 'apps\api\dist\main.js') --worker
    }
    'Web' {
        $env:PORT = '3000'
        $env:HOSTNAME = '127.0.0.1'
        $env:API_INTERNAL_URL = 'http://127.0.0.1:4000'
        & $NodeExecutable (Join-Path $AppRoot 'node_modules\next\dist\bin\next') start (Join-Path $AppRoot 'apps\web') -H '127.0.0.1' -p '3000'
    }
    'Caddy' {
        $caddy = Join-Path $RuntimeRoot 'bin\caddy.exe'
        $config = Join-Path $RuntimeRoot 'caddy\Caddyfile'
        & $caddy run --config $config --adapter caddyfile
    }
}

exit $LASTEXITCODE

