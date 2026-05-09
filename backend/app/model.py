"""
XGBoost ridership demand forecasting model.
Trained on synthetic data anchored to real TTC GTFS structure.
Targets R² ≥ 0.88 on hold-out test set.
"""

import logging
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent / "data" / "cache" / "model.pkl"
META_PATH  = Path(__file__).parent.parent / "data" / "cache" / "model_meta.pkl"

# ── Feature engineering ───────────────────────────────────────────────────────

FEATURES = [
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_peak_am",
    "is_peak_pm",
    "route_type",          # 0=streetcar, 1=subway, 3=bus
    "temp_c",
    "precip_mm",
    "hour_sin",            # cyclical encoding
    "hour_cos",
    "dow_sin",
    "dow_cos",
]


def _add_cyclical(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"]  = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"]  = np.cos(2 * np.pi * df["day_of_week"] / 7)
    return df


# ── Training ──────────────────────────────────────────────────────────────────

def train(df: pd.DataFrame) -> dict:
    """
    Train XGBoost on synthetic ridership DataFrame.
    Returns dict with model, metrics, and feature importances.
    """
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    df = _add_cyclical(df)

    X = df[FEATURES].astype(float)
    y = df["actual_ridership"].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, shuffle=True
    )

    model = XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="reg:squarederror",
        tree_method="hist",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_pred  = model.predict(X_test)
    r2      = float(r2_score(y_test, y_pred))
    mae     = float(mean_absolute_error(y_test, y_pred))
    mape    = float(np.mean(np.abs((y_test - y_pred) / (y_test + 1e-6))) * 100)
    accuracy = round((1 - mape / 100) * 100, 2)

    importances = dict(zip(FEATURES, model.feature_importances_.tolist()))

    meta = {
        "r2":           round(r2, 4),
        "mae":          round(mae, 1),
        "mape":         round(mape, 2),
        "accuracy_pct": accuracy,
        "n_train":      len(X_train),
        "n_test":       len(X_test),
        "features":     FEATURES,
        "importances":  importances,
    }

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(META_PATH, "wb") as f:
        pickle.dump(meta, f)

    logger.info(
        "Model trained — R²=%.4f  MAE=%.0f  Accuracy=%.1f%%  "
        "(train=%d  test=%d)",
        r2, mae, accuracy, len(X_train), len(X_test),
    )
    return {"model": model, **meta}


# ── Inference ─────────────────────────────────────────────────────────────────

def load_model() -> tuple:
    """Load saved model and metadata from disk."""
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    with open(META_PATH, "rb") as f:
        meta = pickle.load(f)
    return model, meta


def predict_day(
    model,
    route_type: int = 1,
    day_of_week: int = 1,
    month: int = 3,
    temp_c: float = 5.0,
    precip_mm: float = 0.0,
) -> list[dict]:
    """
    Predict hourly ridership for a full day given route/weather parameters.
    Returns list of {hour, predicted} dicts.
    """
    rows = []
    for hour in range(24):
        rows.append({
            "hour":        hour,
            "day_of_week": day_of_week,
            "month":       month,
            "is_weekend":  int(day_of_week >= 5),
            "is_peak_am":  int(7 <= hour <= 9),
            "is_peak_pm":  int(16 <= hour <= 18),
            "route_type":  route_type,
            "temp_c":      temp_c,
            "precip_mm":   precip_mm,
        })

    df   = _add_cyclical(pd.DataFrame(rows))
    preds = model.predict(df[FEATURES].astype(float))
    return [{"hour": h, "predicted": max(0, int(p))} for h, p in enumerate(preds)]


# ── Singleton ─────────────────────────────────────────────────────────────────

_model_cache: tuple | None = None


def get_model() -> tuple:
    global _model_cache
    if _model_cache is None:
        _model_cache = load_model()
    return _model_cache
