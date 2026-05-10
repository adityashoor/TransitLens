from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str


class RouteSummary(BaseModel):
    route_id: str
    short_name: str | None
    long_name: str | None
    route_type: int | None
    agency_id: str | None = None
    agency_name: str | None = None


class RouteDetail(RouteSummary):
    route_color: str | None = None
    shape_id: str | None = None
    shape: list[tuple[float, float]] = Field(default_factory=list)


class StopSummary(BaseModel):
    stop_id: str
    stop_code: str | None = None
    stop_name: str
    lat: float | None = None
    lon: float | None = None
    distance_m: float | None = None


class StopDetail(StopSummary):
    routes: list[RouteSummary] = Field(default_factory=list)


class AnnualRidershipRow(BaseModel):
    year: int
    media: str
    rider_type: str
    count: int


class SurfaceRidershipRow(BaseModel):
    route_id: str
    route_name: str
    rank: int | None
    all_day_riders: int | None
    sample_date: date
    route_short_name: str | None = None
    route_long_name: str | None = None


class BikeShareStats(BaseModel):
    group_by: Literal["station", "day", "month", "user_type"]
    rows: list[dict[str, Any]]


class PredictionPoint(BaseModel):
    timestamp: datetime
    predicted_riders: float
    lower_bound: float
    upper_bound: float


class PredictionResponse(BaseModel):
    route_id: str
    model: str
    model_metrics: dict[str, Any] = Field(default_factory=dict)
    points: list[PredictionPoint]


class EquityScore(BaseModel):
    geography_id: str
    geography_name: str | None = None
    area_type: str | None = None
    stop_density: float | None = None
    ridership_per_capita: float | None = None
    median_income: float | None = None
    vulnerable_share: float | None = None
    distance_to_stop: float | None = None
    score: float
    metrics: dict[str, Any] = Field(default_factory=dict)


class DisruptionRequest(BaseModel):
    type: Literal["station_closure", "route_delay", "line_closure"]
    affected_ids: list[str] = Field(min_length=1)
    start_time: datetime
    end_time: datetime
    delay_minutes: int | None = Field(default=None, ge=0, le=240)


class DisruptionResponse(BaseModel):
    type: str
    affected_ids: list[str]
    affected_trip_count: int
    affected_routes: int | None = None
    affected_stops: int | None = None
    average_delay_minutes: float | None = None
    passenger_impact_minutes: float | None = None
    alternatives: list[dict[str, Any]]
    impact_summary: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
