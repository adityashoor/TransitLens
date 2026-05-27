from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routers import equity, prediction, ridership, routes, simulation
from app.schemas import HealthResponse
from app.services.cache import cache


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    description="TransitLens backend API for GTFS, TTC ridership, Bike Share, predictions, equity, and disruption simulation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(ridership.router)
app.include_router(prediction.router)
app.include_router(equity.router)
app.include_router(simulation.router)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    cache_status = await cache.status()
    status = "ok" if not cache_status["enabled"] or cache_status["connected"] else "degraded"
    return {
        "status": status,
        "database": "connected",
        "version": settings.api_version,
    }


@app.get("/health/details", tags=["system"])
async def health_details():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "connected",
        "cache": await cache.status(),
        "version": settings.api_version,
    }


def main() -> None:
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
