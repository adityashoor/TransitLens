param(
    [int]$TransferRadiusM = 250,
    [double]$WalkingMps = 1.3,
    [int]$OdLimit = 35
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

& ".\.venv\Scripts\python.exe" -m transitlens_gtfs.cli build-transit-graph --transfer-radius-m $TransferRadiusM --walking-mps $WalkingMps --od-limit $OdLimit
