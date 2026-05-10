param(
    [string]$TaskName = "TransitLens Equity Annual Refresh",
    [string]$Time = "04:30"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ActionScript = @"
Set-Location "$Root"
& "$Root\.venv\Scripts\python.exe" -m transitlens_gtfs.cli build-equity --force-download *> "$Root\data\logs\equity_annual.log"
"@
$Wrapper = Join-Path $Root "backend\scripts\run_equity_annual.ps1"
$ActionScript | Set-Content -Encoding ASCII $Wrapper

$TaskRun = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"`"$Wrapper`"`""
$Command = 'schtasks.exe /Create /TN "{0}" /TR "{1}" /SC MONTHLY /M FEB /D 15 /ST {2} /F' -f $TaskName, $TaskRun.Replace('"', '\"'), $Time
cmd.exe /c $Command
if ($LASTEXITCODE -ne 0) {
    throw "schtasks.exe failed with exit code $LASTEXITCODE"
}
