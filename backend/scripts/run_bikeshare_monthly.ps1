Set-Location "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens"
& "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens\.venv\Scripts\python.exe" -m transitlens_gtfs.cli ingest-bikeshare --latest-year --force-download --strict *> "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens\data\logs\bikeshare_monthly.log"
