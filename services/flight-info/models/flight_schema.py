from pydantic import BaseModel

class FlightRequest(BaseModel):
    flight_number: str

class FlightResponse(BaseModel):
    flight_number: str
    status: str

class FlightStatus(BaseModel):
    airline: str
    flight_no: str
    status: str
