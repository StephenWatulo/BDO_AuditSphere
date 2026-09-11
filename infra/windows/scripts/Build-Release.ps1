[CmdletBinding()]
param(
    [string]$AppRoot = 'C:\AuditSphere\app',
    [string]$EnvFile = 'C:\AuditSphere\config\production.env'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

& (Join-Path $PSScriptRoot 'Import-Environment.ps1') -FilePath $EnvFile
Set-Location -LiteralPath $AppRoot

& corepack.cmd enable
if ($LASTEXITCODE -ne 0) { throw 'corepack enable failed' }
& pnpm.cmd install --frozen-lockfile --prod=false
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& pnpm.cmd db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed' }
& pnpm.cmd lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
& pnpm.cmd typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
& pnpm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }

$env:NEXT_PUBLIC_API_URL = '/api/v1'
$env:API_INTERNAL_URL = 'http://127.0.0.1:4000'
& pnpm.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed' }

& pnpm.cmd verify:windows
if ($LASTEXITCODE -ne 0) { throw 'Windows deployment safeguard verification failed' }
Write-Host 'PASS: audited dependencies, generated Prisma, linted, typechecked, tested, and built the release.'

