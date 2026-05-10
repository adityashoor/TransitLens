param(
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -e ".\backend"

if (-not (Test-Path ".\backend\.env")) {
    Copy-Item ".\backend\.env.example" ".\backend\.env"
}

if (-not $SkipDocker) {
    docker compose up -d postgis
}

& ".\.venv\Scripts\python.exe" -m transitlens_gtfs.cli init-db
