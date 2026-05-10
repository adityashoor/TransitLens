param(
    [switch]$ForceDownload,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$ArgsList = @("-m", "transitlens_gtfs.cli", "ingest-ridership")
if ($ForceDownload) { $ArgsList += "--force-download" }
if ($Strict) { $ArgsList += "--strict" }

& ".\.venv\Scripts\python.exe" @ArgsList
