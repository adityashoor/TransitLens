"""Generate SQL insert statements for Supabase MCP ingestion."""
import pandas as pd
import json
import sys

CACHE = "data/cache/gtfs"

def q(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

# ── Routes ────────────────────────────────────────────────────────────────────
df = pd.read_parquet(f"{CACHE}/routes.parquet")
df["route_type"] = pd.to_numeric(df["route_type"], errors="coerce").fillna(3).astype(int)
for c in df.columns:
    df[c] = df[c].where(df[c].notna(), None)

vals = []
for row in df.to_dict("records"):
    vals.append(f"({q(row['route_id'])},{q(row.get('agency_id','1'))},{q(row.get('route_short_name'))},{q(row.get('route_long_name'))},{row['route_type']},{q(row.get('route_color'))},{q(row.get('route_text_color'))})")

routes_sql = "INSERT INTO transitlens.routes (route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color) VALUES\n" + ",\n".join(vals) + "\nON CONFLICT (route_id) DO UPDATE SET route_short_name=EXCLUDED.route_short_name, route_long_name=EXCLUDED.route_long_name, route_type=EXCLUDED.route_type;"

with open("scripts/routes.sql", "w", encoding="utf-8") as f:
    f.write(routes_sql)
print(f"routes.sql — {len(vals)} rows")

# ── Stops ─────────────────────────────────────────────────────────────────────
df = pd.read_parquet(f"{CACHE}/stops.parquet")
df["stop_lat"] = pd.to_numeric(df["stop_lat"], errors="coerce")
df["stop_lon"] = pd.to_numeric(df["stop_lon"], errors="coerce")
df = df.dropna(subset=["stop_lat","stop_lon"])
for c in df.columns:
    df[c] = df[c].where(df[c].notna(), None)

vals = []
for row in df.to_dict("records"):
    lat, lon = row["stop_lat"], row["stop_lon"]
    vals.append(f"({q(row['stop_id'])},{q(row.get('stop_code'))},{q(row['stop_name'])},{lat},{lon},ST_SetSRID(ST_MakePoint({lon},{lat}),4326))")

# Split into chunks of 500 for MCP
chunks = [vals[i:i+500] for i in range(0, len(vals), 500)]
for idx, chunk in enumerate(chunks):
    sql = "INSERT INTO transitlens.stops (stop_id,stop_code,stop_name,stop_lat,stop_lon,geom) VALUES\n" + ",\n".join(chunk) + "\nON CONFLICT (stop_id) DO UPDATE SET stop_name=EXCLUDED.stop_name,stop_lat=EXCLUDED.stop_lat,stop_lon=EXCLUDED.stop_lon,geom=EXCLUDED.geom;"
    with open(f"scripts/stops_{idx:02d}.sql", "w", encoding="utf-8") as f:
        f.write(sql)
print(f"stops — {len(vals)} rows in {len(chunks)} chunks")

# ── Equity scores ─────────────────────────────────────────────────────────────
sys.path.insert(0, ".")
from app.data_loader import get_processed
from app.equity import compute_equity_scores

processed = get_processed()
scores = compute_equity_scores(processed["stops"], processed["route_stops"])
vals = []
for z in scores:
    vals.append(f"({q(z['id'])},{q(z['name'])},{z['lat']},{z['lng']},{z['population']},{z['stopDensity']},{z['equityScore']})")

equity_sql = "INSERT INTO transitlens.equity_scores (id,name,lat,lng,population,stop_density,equity_score) VALUES\n" + ",\n".join(vals) + "\nON CONFLICT (id) DO UPDATE SET equity_score=EXCLUDED.equity_score,stop_density=EXCLUDED.stop_density,computed_at=now();"
with open("scripts/equity.sql", "w", encoding="utf-8") as f:
    f.write(equity_sql)
print(f"equity.sql — {len(vals)} rows")

print("\nDone! SQL files written to backend/scripts/")
