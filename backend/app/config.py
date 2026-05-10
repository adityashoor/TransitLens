from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TransitLens API"
    api_version: str = "0.1.0"
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/transitlens",
        validation_alias="DATABASE_URL",
    )
    async_database_url: str | None = Field(default=None, validation_alias="ASYNC_DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    api_cache_enabled: bool = Field(default=False, validation_alias="API_CACHE_ENABLED")
    prediction_model_path: str | None = Field(default=None, validation_alias="PREDICTION_MODEL_PATH")

    model_config = SettingsConfigDict(env_file="backend/.env", extra="ignore")

    @property
    def resolved_async_database_url(self) -> str:
        if self.async_database_url:
            return self.async_database_url
        return (
            self.database_url.replace("postgresql+psycopg://", "postgresql+asyncpg://")
            .replace("postgresql://", "postgresql+asyncpg://")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
