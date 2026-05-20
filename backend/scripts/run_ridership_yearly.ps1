Set-Location "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens"
if ((Get-Date).Month -ne 1) { exit 0 }
& "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens\.venv\Scripts\python.exe" -m transitlens_gtfs.cli ingest-ridership --force-download --strict *> "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens\data\logs\ridership_yearly.log"
