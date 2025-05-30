from pydantic import BaseModel
class FlightSchedule(BaseModel):
    flight: str
    departure: str
