from fastapi import APIRouter, HTTPException
from services.feature_service import ingest_feature, get_feature

router = APIRouter()

@router.post("/ingest")
async def ingest(payload: dict):
    success = await ingest_feature(payload)
    if not success:
        raise HTTPException(status_code=500, detail="Ingest failed")
    return {"status": "ingested"}

@router.get("/{feature_id}")
async def read(feature_id: str):
    feature = await get_feature(feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature
