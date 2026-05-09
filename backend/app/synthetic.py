"""
Synthetic ridership generator.
Anchored to real TTC GTFS route/stop structure.
Per §4 FAQ: using public structural information (routes, stops, schedules from
public GTFS feed) as basis for synthetic demand data is explicitly permitted.
No individual travel records or PII are generated.
"""

import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Route-type capacity/base parameters ──────────────────────────────────────
ROUTE_TYPE_PARAMS = {
    1: {"base": 4500, "capacity": 18000, "label": "Subway"},         # subway
    0: {"base": 1800, "capacity":  6000, "label": "Streetcar"},      # tram/streetcar
    3: {"base":  600, "capacity":  3200, "label": "Bus"},            # bus
}

# ── Temporal demand multipliers ───────────────────────────────────────────────
def _hour_multiplier(hour: int) -> float:
    """Bimodal peak curve — AM peak ~8, PM peak ~17."""
    am = np.exp(-0.5 * ((hour - 8) / 1.4) ** 2)
    pm = np.exp(-0.5 * ((hour - 17) / 1.8) ** 2)
    base = 0.08  # overnight floor
    return float(base + 0.95 * am + 0.82 * pm)


def _dow_multiplier(dow: int) -> float:
    """Day-of-week factor: Mon–Fri ≈ 1.0, Sat ≈ 0.72, Sun ≈ 0.58."""
    return [1.05, 1.00, 1.00, 1.02, 1.08, 0.72, 0.58][dow]


def _month_multiplier(month: int) -> float:
    """Seasonal variation: summer dip (Jul-Aug), winter slight uptick."""
    factors = {1:1.02, 2:1.01, 3:1.00, 4:0.99, 5:1.01, 6:1.03,
               7:0.88, 8:0.85, 9:1.02, 10:1.04, 11:1.03, 12:0.97}
    return factors.get(month, 1.0)


def _weather_multiplier(temp_c: float, precip_mm: float) -> float:
    """Cold or heavy rain reduces ridership slightly (transit can also increase it)."""
    cold  = 0.97 if temp_c < -5 else 1.0
    rain  = 0.96 if precip_mm > 10 else 1.0
    return cold * rain


# ── Core generator ────────────────────────────────────────────────────────────

def generate_ridership(
    routes_df: pd.DataFrame,
    n_days: int = 90,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate n_days × 24h × all routes synthetic ridership dataset.

    Returns DataFrame with columns:
        date, hour, day_of_week, month, route_id, route_type,
        route_type_label, is_weekend, is_peak_am, is_peak_pm,
        temp_c, precip_mm, actual_ridership
    """
    rng  = np.random.default_rng(seed)
    rows = []

    start = date(2025, 10, 1)
    dates = [start + timedelta(days=i) for i in range(n_days)]

    # synthetic weather — Toronto Oct–Dec temperature range
    n_dates = len(dates)
    temps   = rng.normal(loc=2.0,  scale=8.0,  size=n_dates).clip(-25, 25)
    precips = rng.exponential(scale=2.5,        size=n_dates).clip(0, 50)

    # only use a representative sample of routes (≤120) to keep dataset size sane
    route_sample = routes_df.sample(min(120, len(routes_df)), random_state=seed)

    for di, d in enumerate(dates):
        dow   = d.weekday()
        month = d.month
        temp  = temps[di]
        prec  = precips[di]

        dm = _dow_multiplier(dow) * _month_multiplier(month) * _weather_multiplier(temp, prec)

        for _, route in route_sample.iterrows():
            rt     = int(route.get("route_type", 3))
            params = ROUTE_TYPE_PARAMS.get(rt, ROUTE_TYPE_PARAMS[3])

            for hour in range(24):
                hm   = _hour_multiplier(hour)
                base = params["base"] * hm * dm

                # Gaussian noise ±12%
                noise   = rng.normal(1.0, 0.12)
                ridership = max(0, int(base * noise))

                rows.append({
                    "date":            d.isoformat(),
                    "hour":            hour,
                    "day_of_week":     dow,
                    "month":           month,
                    "route_id":        route["route_id"],
                    "route_type":      rt,
                    "route_type_label":params["label"],
                    "capacity":        params["capacity"],
                    "is_weekend":      int(dow >= 5),
                    "is_peak_am":      int(7 <= hour <= 9),
                    "is_peak_pm":      int(16 <= hour <= 18),
                    "temp_c":          round(float(temp), 1),
                    "precip_mm":       round(float(prec), 1),
                    "actual_ridership":ridership,
                })

    df = pd.DataFrame(rows)
    logger.info(
        "Generated %d synthetic ridership records (%d days × %d routes × 24h)",
        len(df), n_days, len(route_sample),
    )
    return df


# ── Per-station heatmap ────────────────────────────────────────────────────────

def generate_station_heatmap(stops_df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    """
    Generate a representative station × day-of-week ridership heatmap.
    Uses top 10 stops by synthetic demand score.
    """
    rng = np.random.default_rng(seed)

    # pick 10 well-known/high-demand stops by name heuristic
    priority_keywords = ["union", "bloor", "yonge", "spadina", "sheppard",
                         "finch", "kennedy", "kipling", "york", "st. george"]

    def _score(name: str) -> int:
        n = name.lower()
        for i, kw in enumerate(priority_keywords):
            if kw in n:
                return len(priority_keywords) - i
        return 0

    stops_df = stops_df.copy()
    stops_df["_priority"] = stops_df["stop_name"].apply(_score)
    top = stops_df.nlargest(10, "_priority")[["stop_id", "stop_name"]]

    base_demands = {
        "union":     9500, "bloor":  8600, "yonge": 7800,
        "spadina":   6100, "sheppard":5300,"finch":  4700,
        "kennedy":   4100, "kipling": 3800,"york":   3500,
        "st. george":3200,
    }

    rows = []
    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    dow_factors = [1.05, 1.00, 1.00, 1.02, 1.08, 0.72, 0.58]

    for _, stop in top.iterrows():
        base = 3000
        for kw, val in base_demands.items():
            if kw in stop["stop_name"].lower():
                base = val
                break

        row = {"station": stop["stop_name"].split(" Station")[0].title(),
               "stop_id": stop["stop_id"]}
        for d, factor in zip(days, dow_factors):
            row[d] = max(500, int(base * factor * rng.normal(1.0, 0.05)))
        rows.append(row)

    return pd.DataFrame(rows)
