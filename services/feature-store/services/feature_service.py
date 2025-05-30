import aioredis
from db.models import FeatureModel

redis = aioredis.from_url("redis://localhost")

async def ingest_feature(payload: dict) -> bool:
    # Validate schema
    feature = FeatureModel(**payload)
    await redis.hset("features", feature.id, feature.json())
    return True

async def get_feature(feature_id: str) -> dict:
    data = await redis.hget("features", feature_id)
    if not data:
        return None
    return FeatureModel.parse_raw(data).dict()
