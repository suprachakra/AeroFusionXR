from fastapi import APIRouter, HTTPException, Depends
from models import FeatureIn, FeatureOut
from services.feature_service import FeatureService

router = APIRouter()

@router.post("/", response_model=FeatureOut)
async def ingest_feature(payload: FeatureIn):
    try:
        return await FeatureService.ingest(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{key}", response_model=FeatureOut)
async def get_feature(key: str):
    result = await FeatureService.retrieve(key)
    if not result:
        raise HTTPException(404, "Feature not found")
    return result
