param(
    [switch]$Download,
    [switch]$ForceDownload,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$ArgsList = @("-m", "transitlens_gtfs.cli", "ingest")
if ($Download) { $ArgsList += "--download" }
if ($ForceDownload) { $ArgsList += "--force-download" }
if ($Strict) { $ArgsList += "--strict" }

& ".\.venv\Scripts\python.exe" @ArgsList
