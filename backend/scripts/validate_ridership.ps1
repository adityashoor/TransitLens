$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

& ".\.venv\Scripts\python.exe" -m transitlens_gtfs.cli validate-ridership
