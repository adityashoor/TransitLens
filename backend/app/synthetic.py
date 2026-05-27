"""
synthetic.py — Generate synthetic ridership data based on real TTC routes.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Base daily ridership by route type (subway / streetcar / bus)
BASE_RIDERSHIP = {1: 18000, 0: 4500, 3: 2200}
# Hourly shape: morning peak, midday, evening peak, night trough
HOUR_WEIGHTS = np.array([
    0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.5, 2.8,   # 0-7
    3.0, 2.2, 1.8, 1.7, 1.9, 2.0, 2.1, 2.5,   # 8-15
    3.2, 3.0, 2.4, 1.8, 1.3, 0.9, 0.6, 0.3,   # 16-23
])
HOUR_WEIGHTS /= HOUR_WEIGHTS.sum()

DAY_MULT = {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.05, 5: 0.75, 6: 0.60}
MONTH_MULT = {1: 0.88, 2: 0.90, 3: 0.94, 4: 0.97, 5: 1.02, 6: 0.95,
              7: 0.90, 8: 0.93, 9: 1.02, 10: 1.03, 11: 0.95, 12: 0.87}


def generate_ridership(routes_df: pd.DataFrame, n_days: int = 90,
                       seed: int = 42) -> pd.DataFrame:
    """
    Generate n_days of hourly ridership per route.
    Returns a DataFrame with columns:
      route_id, route_type, date, day_of_week, month, hour,
      temp_c, precip_mm, actual_ridership
    """
    rng = np.random.default_rng(seed)
    rows = []

    start = pd.Timestamp("2025-01-01")
    dates = pd.date_range(start, periods=n_days, freq="D")

    for _, route in routes_df.iterrows():
        rt = int(route.get("route_type", 3))
        base = BASE_RIDERSHIP.get(rt, 2200)

        for d in dates:
            dow   = d.dayofweek
            month = d.month
            temp  = rng.normal(loc={1: -5, 2: -3, 3: 3, 4: 10, 5: 17, 6: 22,
                                     7: 25, 8: 24, 9: 18, 10: 11, 11: 4, 12: -2}.get(month, 10), scale=3)
            precip = max(0.0, rng.normal(0, 2) if rng.random() < 0.3 else 0.0)

            day_total = base * DAY_MULT[dow] * MONTH_MULT[month]
            if precip > 5:
                day_total *= 0.92

            for hour in range(24):
                riders = max(0, int(
                    day_total * HOUR_WEIGHTS[hour] * rng.uniform(0.88, 1.12)
                ))
                rows.append({
                    "route_id":        route["route_id"],
                    "route_type":      rt,
                    "date":            d.date(),
                    "day_of_week":     dow,
                    "month":           month,
                    "hour":            hour,
                    "temp_c":          round(float(temp), 1),
                    "precip_mm":       round(float(precip), 1),
                    "actual_ridership": riders,
                })

    return pd.DataFrame(rows)


def generate_station_heatmap(stops_gdf) -> pd.DataFrame:
    """
    Return a DataFrame with one row per stop with a synthetic busyness score.
    """
    rng = np.random.default_rng(99)
    stops = stops_gdf[["stop_id", "stop_name", "stop_lat", "stop_lon"]].copy()
    stops["ridership"]   = rng.integers(200, 12000, size=len(stops))
    stops["intensity"]   = (stops["ridership"] / stops["ridership"].max()).round(3)
    return stops.reset_index(drop=True)
