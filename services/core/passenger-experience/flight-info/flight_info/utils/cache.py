import json
from typing import Any, Dict, Optional, Union

from redis.asyncio import Redis


class Cache:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get a value from cache."""
        value = await self.redis.get(key)
        return json.loads(value) if value else None

    async def set(
        self,
        key: str,
        value: Union[Dict[str, Any], str],
        ttl: Optional[int] = None
    ) -> bool:
        """Set a value in cache with optional TTL."""
        try:
            if isinstance(value, dict):
                value = json.dumps(value)
            if ttl:
                await self.redis.setex(key, ttl, value)
            else:
                await self.redis.set(key, value)
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        """Delete a value from cache."""
        return await self.redis.delete(key) > 0

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        return await self.redis.exists(key) > 0

    async def increment(self, key: str, amount: int = 1) -> int:
        """Increment a counter in cache."""
        return await self.redis.incrby(key, amount)

    async def decrement(self, key: str, amount: int = 1) -> int:
        """Decrement a counter in cache."""
        return await self.redis.decrby(key, amount)

    async def set_add(self, key: str, *values: str) -> int:
        """Add values to a set."""
        return await self.redis.sadd(key, *values)

    async def set_remove(self, key: str, *values: str) -> int:
        """Remove values from a set."""
        return await self.redis.srem(key, *values)

    async def set_members(self, key: str) -> set[str]:
        """Get all members of a set."""
        members = await self.redis.smembers(key)
        return {m.decode() for m in members}

    async def set_contains(self, key: str, value: str) -> bool:
        """Check if a value is in a set."""
        return await self.redis.sismember(key, value)

    async def hash_set(self, key: str, mapping: Dict[str, Any]) -> bool:
        """Set multiple hash fields."""
        try:
            serialized = {k: json.dumps(v) for k, v in mapping.items()}
            await self.redis.hset(key, mapping=serialized)
            return True
        except Exception:
            return False

    async def hash_get(self, key: str, field: str) -> Optional[Dict[str, Any]]:
        """Get a hash field."""
        value = await self.redis.hget(key, field)
        return json.loads(value) if value else None

    async def hash_get_all(self, key: str) -> Dict[str, Any]:
        """Get all hash fields."""
        result = await self.redis.hgetall(key)
        return {
            k.decode(): json.loads(v.decode())
            for k, v in result.items()
        }

    async def hash_delete(self, key: str, *fields: str) -> int:
        """Delete hash fields."""
        return await self.redis.hdel(key, *fields)

    async def list_push(self, key: str, *values: Any) -> int:
        """Push values to a list."""
        try:
            serialized = [
                json.dumps(v) if isinstance(v, (dict, list)) else v
                for v in values
            ]
            return await self.redis.rpush(key, *serialized)
        except Exception:
            return 0

    async def list_pop(self, key: str) -> Optional[Any]:
        """Pop a value from a list."""
        value = await self.redis.lpop(key)
        if not value:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value.decode()

    async def list_range(self, key: str, start: int = 0, end: int = -1) -> list[Any]:
        """Get a range of values from a list."""
        values = await self.redis.lrange(key, start, end)
        result = []
        for v in values:
            try:
                result.append(json.loads(v))
            except json.JSONDecodeError:
                result.append(v.decode())
        return result

    async def clear_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        keys = []
        async for key in self.redis.scan_iter(pattern):
            keys.append(key)
        if keys:
            return await self.redis.delete(*keys)
        return 0

    async def clear_all(self) -> bool:
        """Clear all keys in the current database."""
        try:
            await self.redis.flushdb()
            return True
        except Exception:
            return False 