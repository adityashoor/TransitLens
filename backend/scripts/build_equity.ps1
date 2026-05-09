param(
    [switch]$ForceDownload
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$argsList = @("build-equity")
if ($ForceDownload) {
    $argsList += "--force-download"
}

& ".\.venv\Scripts\python.exe" -m transitlens_gtfs.cli @argsList
