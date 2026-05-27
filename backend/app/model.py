"""
model.py — XGBoost ridership prediction model.
Loads from cache if available, otherwise trains fresh.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "data" / "cache" / "model.pkl"
META_PATH  = Path(__file__).parent.parent / "data" / "cache" / "model_meta.pkl"

FEATURES = [
    "hour", "day_of_week", "month", "is_weekend",
    "is_peak_am", "is_peak_pm", "route_type",
    "temp_c", "precip_mm", "hour_sin", "hour_cos", "dow_sin", "dow_cos",
]


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
    df["is_peak_am"]  = df["hour"].between(7, 9).astype(int)
    df["is_peak_pm"]  = df["hour"].between(16, 18).astype(int)
    df["hour_sin"]    = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"]    = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"]     = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"]     = np.cos(2 * np.pi * df["day_of_week"] / 7)
    return df


def get_model():
    """Load cached model + metadata."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(META_PATH, "rb") as f:
            meta = pickle.load(f)
    return model, meta


def train(ridership_df: pd.DataFrame) -> dict:
    """Train XGBoost on synthetic ridership data, cache result."""
    from xgboost import XGBRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import r2_score, mean_absolute_error

    df = _build_features(ridership_df)
    X = df[FEATURES]
    y = df["actual_ridership"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)

    model = XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1,
                         subsample=0.8, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    r2  = float(round(r2_score(y_test, preds), 4))
    mae = float(round(mean_absolute_error(y_test, preds), 1))
    mape = float(round(np.mean(np.abs((y_test - preds) / np.maximum(y_test, 1))) * 100, 1))
    acc  = float(round(100 - mape, 1))

    importances = dict(zip(FEATURES, model.feature_importances_.tolist()))

    meta = {
        "r2": r2, "mae": mae, "mape": mape, "accuracy_pct": acc,
        "n_train": len(X_train), "n_test": len(X_test),
        "features": FEATURES, "importances": importances,
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(META_PATH, "wb") as f:
        pickle.dump(meta, f)

    return {"model": model, **meta}


def predict_day(model, route_type: int, day_of_week: int, month: int,
                temp_c: float, precip_mm: float) -> list[dict]:
    """Return hourly predictions (0-23) for the given parameters."""
    rows = []
    for hour in range(24):
        rows.append({
            "hour": hour, "day_of_week": day_of_week, "month": month,
            "route_type": route_type, "temp_c": temp_c, "precip_mm": precip_mm,
        })
    df = _build_features(pd.DataFrame(rows))
    preds = model.predict(df[FEATURES])

    result = []
    for i, hour in enumerate(range(24)):
        result.append({"hour": hour, "predicted": max(0, int(round(preds[i])))})
    return result
