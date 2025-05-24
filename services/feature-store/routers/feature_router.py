from fastapi import APIRouter, HTTPException
from db.models import store_feature

router = APIRouter()

@router.post("/")
def ingest(feature: dict):
    try:
        return store_feature(feature)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
