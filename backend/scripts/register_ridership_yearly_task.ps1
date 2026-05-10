param(
    [string]$TaskName = "TransitLens TTC Ridership Yearly Refresh",
    [string]$Time = "04:00"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ActionScript = @"
Set-Location "$Root"
if ((Get-Date).Month -ne 1) { exit 0 }
& "$Root\.venv\Scripts\python.exe" -m transitlens_gtfs.cli ingest-ridership --force-download --strict *> "$Root\data\logs\ridership_yearly.log"
"@
$Wrapper = Join-Path $Root "backend\scripts\run_ridership_yearly.ps1"
$ActionScript | Set-Content -Encoding ASCII $Wrapper

$TaskRun = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"`"$Wrapper`"`""
$Command = 'schtasks.exe /Create /TN "{0}" /TR "{1}" /SC MONTHLY /M JAN /D 15 /ST {2} /F' -f $TaskName, $TaskRun.Replace('"', '\"'), $Time
cmd.exe /c $Command
if ($LASTEXITCODE -ne 0) {
    throw "schtasks.exe failed with exit code $LASTEXITCODE"
}
