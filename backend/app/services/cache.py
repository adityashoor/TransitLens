from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis
from redis.exceptions import RedisError

from app.config import get_settings


class Cache:
    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = settings.api_cache_enabled
        self._client: redis.Redis | None = (
            redis.from_url(settings.redis_url, decode_responses=True) if self.enabled else None
        )
        self.last_error: str | None = None

    async def get_json(self, key: str) -> Any | None:
        if not self._client:
            return None
        try:
            value = await self._client.get(key)
            self.last_error = None
            return json.loads(value) if value else None
        except (RedisError, OSError) as exc:
            self.last_error = str(exc)
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if self._client:
            try:
                await self._client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
                self.last_error = None
            except (RedisError, OSError) as exc:
                self.last_error = str(exc)

    async def status(self) -> dict[str, str | bool | None]:
        if not self._client:
            return {"enabled": self.enabled, "connected": False, "error": None}
        try:
            await self._client.ping()
            self.last_error = None
            return {"enabled": self.enabled, "connected": True, "error": None}
        except (RedisError, OSError) as exc:
            self.last_error = str(exc)
            return {"enabled": self.enabled, "connected": False, "error": self.last_error}


cache = Cache()
