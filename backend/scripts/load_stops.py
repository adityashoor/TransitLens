"""
Load stops into Supabase using the pre-generated SQL chunks.
Run: python backend/scripts/load_stops.py
Set SUPABASE_DB_URL first.
"""
import os, sys, glob
from pathlib import Path

DB_URL = os.environ.get("SUPABASE_DB_URL","")
if not DB_URL:
    print("Set SUPABASE_DB_URL first")
    sys.exit(1)

import psycopg

files = sorted(glob.glob(str(Path(__file__).parent / "stops_*.sql")))
print(f"Loading {len(files)} stop chunks...")

with psycopg.connect(DB_URL) as conn:
    for f in files:
        sql = Path(f).read_text(encoding="utf-8")
        conn.execute(sql)
        conn.commit()
        print(f"  ✅ {Path(f).name}")

print("Done — all stops loaded!")
