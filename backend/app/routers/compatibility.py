from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.services import equity, transit
from app.services.prediction import prediction_service


router = APIRouter(prefix="/api", tags=["frontend-compatibility"])


@router.get("/gtfs/routes")
async def gtfs_routes(
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    rows = await transit.list_routes(session, route_type=None, agency_id=None)
    return [
        {
            "route_id": row["route_id"],
            "route_short_name": row["short_name"],
            "route_long_name": row["long_name"],
            "route_type": row["route_type"],
            "agency_id": row["agency_id"],
            "agency_name": row["agency_name"],
        }
        for row in rows[:limit]
    ]


@router.get("/gtfs/stops")
async def gtfs_stops(
    limit: int = Query(default=500, ge=1, le=3000),
    session: AsyncSession = Depends(get_session),
):
    rows = await transit.list_stops(
        session,
        min_lat=None,
        min_lon=None,
        max_lat=None,
        max_lon=None,
        lat=None,
        lon=None,
        radius_m=None,
        limit=limit,
    )
    return [
        {
            "stop_id": row["stop_id"],
            "stop_name": row["stop_name"],
            "stop_lat": row["lat"],
            "stop_lon": row["lon"],
        }
        for row in rows
    ]


@router.get("/equity/scores")
async def equity_scores(
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    if not await equity.equity_table_available(session):
        raise HTTPException(
            status_code=501,
            detail="Equity score table is not available yet. Run the equity pipeline first.",
        )
    result = await session.execute(
        text(
            """
            SELECT
                geography_id,
                geography_name,
                score,
                stop_density,
                median_income,
                vulnerable_share,
                metrics,
                ST_Y(ST_PointOnSurface(geom)) AS lat,
                ST_X(ST_PointOnSurface(geom)) AS lng
            FROM equity_scores
            ORDER BY score ASC, geography_name
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    rows = []
    for row in result.mappings():
        metrics = dict(row["metrics"] or {})
        rows.append(
            {
                "id": row["geography_id"],
                "name": row["geography_name"],
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "equityScore": round(float(row["score"]), 2),
                "equity_score": round(float(row["score"]), 2),
                "stopDensity": float(row["stop_density"]),
                "stop_density": float(row["stop_density"]),
                "income": row["median_income"],
                "vulnerability": row["vulnerable_share"],
                "population": metrics.get("population", 0),
                "stopCount": metrics.get("stop_count", 0),
                "routeCount": metrics.get("route_count", 0),
                "metrics": metrics,
            }
        )
    return rows


@router.get("/model/metrics")
async def model_metrics(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        text(
            """
            SELECT training_rows, test_rows, metrics, feature_columns
            FROM ml_model_versions
            WHERE active = true
            ORDER BY trained_at DESC
            LIMIT 1
            """
        )
    )
    row = result.mappings().first()
    metrics = dict(row["metrics"] or {}) if row else prediction_service.metrics
    test = dict(metrics.get("test", metrics))
    mape = test.get("mape")
    features = list(row["feature_columns"] or []) if row else prediction_service.feature_columns
    model = prediction_service.model
    importances = {}
    if model is not None and hasattr(model, "feature_importances_"):
        importances = {
            feature: round(float(importance), 6)
            for feature, importance in zip(features, model.feature_importances_, strict=False)
        }
    return {
        "r2": test.get("r2"),
        "mae": test.get("mae"),
        "mape": mape,
        "accuracy_pct": round(100 - float(mape), 2) if mape is not None else None,
        "n_train": row["training_rows"] if row else None,
        "n_test": row["test_rows"] if row else None,
        "features": features,
        "importances": importances,
        "model": prediction_service.model_name,
    }


@router.get("/kpi")
async def kpi(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        text(
            """
            SELECT
                (SELECT COUNT(*) FROM routes) AS total_routes,
                (SELECT COUNT(*) FROM stops) AS total_stops,
                (SELECT COALESCE(SUM(all_day_riders), 0) FROM surface_route_ridership) AS daily_ridership,
                (SELECT AVG(score) FROM equity_scores) AS average_equity_score
            """
        )
    )
    row = result.mappings().one()
    metrics = await model_metrics(session)
    return {
        "totalRoutes": int(row["total_routes"]),
        "totalStops": int(row["total_stops"]),
        "dailyRidership": int(row["daily_ridership"]),
        "avgEquityScore": round(float(row["average_equity_score"]), 1)
        if row["average_equity_score"] is not None
        else None,
        "disruptionIndex": 0.0,
        "demandForecastAccuracy": metrics["accuracy_pct"],
        "modelR2": metrics["r2"],
        "modelMAE": metrics["mae"],
    }
