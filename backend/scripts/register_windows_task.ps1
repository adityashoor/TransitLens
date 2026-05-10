param(
    [string]$TaskName = "TransitLens TTC GTFS Monthly Refresh",
    [string]$Time = "03:00"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ActionScript = @"
Set-Location "$Root"
& "$Root\.venv\Scripts\python.exe" -m transitlens_gtfs.cli ingest --download --force-download --strict *> "$Root\data\logs\gtfs_monthly.log"
"@
$Wrapper = Join-Path $Root "backend\scripts\run_gtfs_monthly.ps1"
$ActionScript | Set-Content -Encoding ASCII $Wrapper

$TaskRun = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"`"$Wrapper`"`""
$Command = 'schtasks.exe /Create /TN "{0}" /TR "{1}" /SC MONTHLY /D 1 /ST {2} /F' -f $TaskName, $TaskRun.Replace('"', '\"'), $Time
cmd.exe /c $Command
if ($LASTEXITCODE -ne 0) {
    throw "schtasks.exe failed with exit code $LASTEXITCODE"
}
