"""
ingest_supabase.py — Load local GTFS parquet cache into Supabase (transitlens schema).

Usage:
  set SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
  python backend/scripts/ingest_supabase.py

Get your connection string from:
  Supabase dashboard → Project Settings → Database → Connection string → URI (Transaction pooler)
"""

import os
import sys
import logging
from pathlib import Path

import pandas as pd
import psycopg
from psycopg.rows import dict_row

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

CACHE = Path(__file__).parent.parent / "data" / "cache" / "gtfs"
DB_URL = os.environ.get("SUPABASE_DB_URL", "")

if not DB_URL:
    print("\n❌  Set SUPABASE_DB_URL env var first.")
    print("    Get it from: Supabase dashboard → Settings → Database → URI (Transaction pooler)\n")
    sys.exit(1)


def load(table: str) -> pd.DataFrame:
    p = CACHE / f"{table}.parquet"
    if not p.exists():
        log.warning("Missing parquet: %s", p)
        return pd.DataFrame()
    df = pd.read_parquet(p)
    log.info("Loaded %s — %d rows", table, len(df))
    return df


def ingest_routes(cur, df: pd.DataFrame):
    if df.empty:
        return
    cur.executemany(
        """
        INSERT INTO transitlens.routes
          (route_id, agency_id, route_short_name, route_long_name, route_type,
           route_color, route_text_color, route_url, route_desc)
        VALUES (%(route_id)s, %(agency_id)s, %(route_short_name)s, %(route_long_name)s,
                %(route_type)s, %(route_color)s, %(route_text_color)s, %(route_url)s, %(route_desc)s)
        ON CONFLICT (route_id) DO UPDATE SET
          route_short_name = EXCLUDED.route_short_name,
          route_long_name  = EXCLUDED.route_long_name,
          route_type       = EXCLUDED.route_type
        """,
        df.where(pd.notnull(df), None).to_dict("records"),
    )
    log.info("✅ routes — %d rows", len(df))


def ingest_stops(cur, df: pd.DataFrame):
    if df.empty:
        return
    df["stop_lat"] = pd.to_numeric(df["stop_lat"], errors="coerce")
    df["stop_lon"] = pd.to_numeric(df["stop_lon"], errors="coerce")
    df = df.dropna(subset=["stop_lat", "stop_lon"])
    cur.executemany(
        """
        INSERT INTO transitlens.stops
          (stop_id, stop_code, stop_name, stop_lat, stop_lon,
           location_type, parent_station, wheelchair_boarding,
           geom)
        VALUES (%(stop_id)s, %(stop_code)s, %(stop_name)s, %(stop_lat)s, %(stop_lon)s,
                %(location_type)s, %(parent_station)s, %(wheelchair_boarding)s,
                ST_SetSRID(ST_MakePoint(%(stop_lon)s, %(stop_lat)s), 4326))
        ON CONFLICT (stop_id) DO UPDATE SET
          stop_name = EXCLUDED.stop_name,
          stop_lat  = EXCLUDED.stop_lat,
          stop_lon  = EXCLUDED.stop_lon,
          geom      = EXCLUDED.geom
        """,
        df.where(pd.notnull(df), None).to_dict("records"),
    )
    log.info("✅ stops — %d rows", len(df))


def ingest_trips(cur, df: pd.DataFrame):
    if df.empty:
        return
    # Only keep trips whose route_id exists
    cur.execute("SELECT route_id FROM transitlens.routes")
    valid = {r[0] for r in cur.fetchall()}
    df = df[df["route_id"].isin(valid)]
    cols = ["trip_id","route_id","service_id","trip_headsign",
            "direction_id","shape_id","wheelchair_accessible","bikes_allowed"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    cur.executemany(
        """
        INSERT INTO transitlens.trips
          (trip_id, route_id, service_id, trip_headsign,
           direction_id, shape_id, wheelchair_accessible, bikes_allowed)
        VALUES (%(trip_id)s, %(route_id)s, %(service_id)s, %(trip_headsign)s,
                %(direction_id)s, %(shape_id)s, %(wheelchair_accessible)s, %(bikes_allowed)s)
        ON CONFLICT (trip_id) DO NOTHING
        """,
        df[cols].where(pd.notnull(df[cols]), None).to_dict("records"),
    )
    log.info("✅ trips — %d rows", len(df))


def ingest_stop_times(cur, df: pd.DataFrame):
    if df.empty:
        return
    cur.execute("SELECT trip_id FROM transitlens.trips")
    valid_trips = {r[0] for r in cur.fetchall()}
    cur.execute("SELECT stop_id FROM transitlens.stops")
    valid_stops = {r[0] for r in cur.fetchall()}
    df = df[df["trip_id"].isin(valid_trips) & df["stop_id"].isin(valid_stops)]
    cols = ["trip_id","stop_sequence","stop_id","arrival_time","departure_time","pickup_type","drop_off_type"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df["stop_sequence"] = pd.to_numeric(df["stop_sequence"], errors="coerce").fillna(0).astype(int)
    # batch insert in chunks to avoid memory issues
    chunk = 5000
    total = 0
    for i in range(0, len(df), chunk):
        batch = df[cols].iloc[i:i+chunk].where(pd.notnull(df[cols].iloc[i:i+chunk]), None).to_dict("records")
        cur.executemany(
            """
            INSERT INTO transitlens.stop_times
              (trip_id, stop_sequence, stop_id, arrival_time, departure_time, pickup_type, drop_off_type)
            VALUES (%(trip_id)s, %(stop_sequence)s, %(stop_id)s, %(arrival_time)s,
                    %(departure_time)s, %(pickup_type)s, %(drop_off_type)s)
            ON CONFLICT (trip_id, stop_sequence) DO NOTHING
            """,
            batch,
        )
        total += len(batch)
        log.info("  stop_times %d / %d", total, len(df))
    log.info("✅ stop_times — %d rows", total)


def ingest_shapes(cur, df: pd.DataFrame):
    if df.empty:
        return
    cols = ["shape_id","shape_pt_sequence","shape_pt_lat","shape_pt_lon"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df["shape_pt_sequence"] = pd.to_numeric(df["shape_pt_sequence"], errors="coerce").fillna(0).astype(int)
    chunk = 10000
    total = 0
    for i in range(0, len(df), chunk):
        batch = df[cols].iloc[i:i+chunk].where(pd.notnull(df[cols].iloc[i:i+chunk]), None).to_dict("records")
        cur.executemany(
            """
            INSERT INTO transitlens.shapes (shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon)
            VALUES (%(shape_id)s, %(shape_pt_sequence)s, %(shape_pt_lat)s, %(shape_pt_lon)s)
            ON CONFLICT (shape_id, shape_pt_sequence) DO NOTHING
            """,
            batch,
        )
        total += len(batch)
    log.info("✅ shapes — %d rows", total)


def ingest_equity(cur):
    """Generate equity scores using the same logic as app/equity.py and insert."""
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from app.data_loader import get_processed
    from app.equity import compute_equity_scores

    log.info("Computing equity scores from real stop data …")
    processed = get_processed()
    scores = compute_equity_scores(processed["stops"], processed["route_stops"])

    cur.executemany(
        """
        INSERT INTO transitlens.equity_scores
          (id, name, lat, lng, population, stop_density, equity_score)
        VALUES (%(id)s, %(name)s, %(lat)s, %(lng)s, %(population)s, %(stopDensity)s, %(equityScore)s)
        ON CONFLICT (id) DO UPDATE SET
          equity_score = EXCLUDED.equity_score,
          stop_density = EXCLUDED.stop_density,
          computed_at  = now()
        """,
        scores,
    )
    log.info("✅ equity_scores — %d rows", len(scores))


def ingest_service_gaps(cur):
    """Compute service gap zones and insert."""
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from app.data_loader import get_processed
    from app.equity import compute_equity_scores

    processed = get_processed()
    equity_scores = compute_equity_scores(processed["stops"], processed["route_stops"])
    scores = [z["equityScore"] for z in equity_scores]
    threshold = min(80, sorted(scores)[len(scores) // 2])
    gap_zones = [z for z in equity_scores if z["equityScore"] <= threshold]
    gap_zones.sort(key=lambda z: (z["stopDensity"], -z["population"]))

    rows = []
    for z in gap_zones[:6]:
        gap_magnitude = max(0.05, (threshold - z["equityScore"]) / max(threshold, 1))
        estimated_riders = int(z["population"] * 0.08 * gap_magnitude)
        gap_score = 100 - z["equityScore"]
        cost_k = 120 + gap_score
        rows.append({
            "id": z["id"], "name": z["name"], "lat": z["lat"], "lng": z["lng"],
            "population": z["population"], "stop_density": z["stopDensity"],
            "gap_score": gap_score, "equity_score": z["equityScore"],
            "proposed_lat": round(z["lat"] + 0.003, 4),
            "proposed_lng": round(z["lng"] - 0.003, 4),
            "estimated_benefit": estimated_riders,
            "cost_estimate_k": cost_k,
            "roi_score": round(estimated_riders / max(1, cost_k), 2),
        })

    cur.executemany(
        """
        INSERT INTO transitlens.service_gap_zones
          (id, name, lat, lng, population, stop_density, gap_score, equity_score,
           proposed_lat, proposed_lng, estimated_benefit, cost_estimate_k, roi_score)
        VALUES (%(id)s, %(name)s, %(lat)s, %(lng)s, %(population)s, %(stop_density)s,
                %(gap_score)s, %(equity_score)s, %(proposed_lat)s, %(proposed_lng)s,
                %(estimated_benefit)s, %(cost_estimate_k)s, %(roi_score)s)
        ON CONFLICT (id) DO UPDATE SET
          gap_score        = EXCLUDED.gap_score,
          equity_score     = EXCLUDED.equity_score,
          computed_at      = now()
        """,
        rows,
    )
    log.info("✅ service_gap_zones — %d rows", len(rows))


def main():
    log.info("Connecting to Supabase …")
    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            log.info("Loading GTFS parquet files …")
            routes     = load("routes")
            stops      = load("stops")
            trips      = load("trips")
            stop_times = load("stop_times")
            shapes     = load("shapes")

            ingest_routes(cur, routes)
            conn.commit()

            ingest_stops(cur, stops)
            conn.commit()

            ingest_trips(cur, trips)
            conn.commit()

            ingest_stop_times(cur, stop_times)
            conn.commit()

            ingest_shapes(cur, shapes)
            conn.commit()

            ingest_equity(cur)
            conn.commit()

            ingest_service_gaps(cur)
            conn.commit()

    log.info("🎉 All done — TransitLens data loaded into transitlens schema")


if __name__ == "__main__":
    main()
