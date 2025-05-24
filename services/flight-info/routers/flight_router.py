from fastapi import APIRouter, HTTPException
from services.circuit_breaker import CircuitBreaker
from models.flight_schema import FlightRequest, FlightResponse

router = APIRouter()

@router.post("/status", response_model=FlightResponse)
def get_status(req: FlightRequest):
    try:
        status = CircuitBreaker.call_external(req.flight_number)
        return {"flight_number": req.flight_number, "status": status}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
