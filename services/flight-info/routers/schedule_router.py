from fastapi import APIRouter, Query
from services.schedule_service import get_schedule

router = APIRouter()

@router.get("/")
async def schedule(date: str = Query(..., description="YYYY-MM-DD")):
    return await get_schedule(date)
