[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    throw "Environment file not found: $FilePath"
}

foreach ($line in Get-Content -LiteralPath $FilePath -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { throw "Invalid environment line: $line" }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1)
    if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw "Invalid environment variable name: $name" }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

