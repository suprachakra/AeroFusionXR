from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class FlightStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    BOARDING = "BOARDING"
    DEPARTED = "DEPARTED"
    IN_AIR = "IN_AIR"
    LANDED = "LANDED"
    ARRIVED = "ARRIVED"
    DELAYED = "DELAYED"
    CANCELLED = "CANCELLED"
    DIVERTED = "DIVERTED"


class Airport(BaseModel):
    code: str = Field(..., description="IATA airport code")
    name: str = Field(..., description="Airport name")
    city: str = Field(..., description="City name")
    country: str = Field(..., description="Country name")
    timezone: str = Field(..., description="Airport timezone")
    location: Dict[str, float] = Field(
        ..., description="Airport coordinates (latitude, longitude)"
    )
    terminals: List[str] = Field(default_factory=list, description="List of terminals")


class Gate(BaseModel):
    terminal: str = Field(..., description="Terminal name/number")
    number: str = Field(..., description="Gate number")
    status: str = Field(default="ACTIVE", description="Gate status")


class Aircraft(BaseModel):
    registration: str = Field(..., description="Aircraft registration number")
    type: str = Field(..., description="Aircraft type (e.g., B737, A320)")
    airline: str = Field(..., description="Operating airline")
    capacity: int = Field(..., description="Total passenger capacity")


class FlightDelay(BaseModel):
    duration: int = Field(..., description="Delay duration in minutes")
    reason: str = Field(..., description="Reason for delay")
    estimated_recovery: Optional[datetime] = Field(
        None, description="Estimated time when delay will be resolved"
    )


class FlightPosition(BaseModel):
    latitude: float = Field(..., description="Current latitude")
    longitude: float = Field(..., description="Current longitude")
    altitude: float = Field(..., description="Current altitude in feet")
    heading: float = Field(..., description="Current heading in degrees")
    groundspeed: float = Field(..., description="Ground speed in knots")
    timestamp: datetime = Field(..., description="Position timestamp")


class Flight(BaseModel):
    flight_number: str = Field(..., description="Flight number")
    airline: str = Field(..., description="Operating airline")
    origin: Airport = Field(..., description="Origin airport")
    destination: Airport = Field(..., description="Destination airport")
    scheduled_departure: datetime = Field(..., description="Scheduled departure time")
    scheduled_arrival: datetime = Field(..., description="Scheduled arrival time")
    actual_departure: Optional[datetime] = Field(None, description="Actual departure time")
    actual_arrival: Optional[datetime] = Field(None, description="Actual arrival time")
    estimated_departure: Optional[datetime] = Field(
        None, description="Estimated departure time"
    )
    estimated_arrival: Optional[datetime] = Field(None, description="Estimated arrival time")
    status: FlightStatus = Field(default=FlightStatus.SCHEDULED, description="Flight status")
    departure_gate: Optional[Gate] = Field(None, description="Departure gate")
    arrival_gate: Optional[Gate] = Field(None, description="Arrival gate")
    aircraft: Optional[Aircraft] = Field(None, description="Operating aircraft")
    delay: Optional[FlightDelay] = Field(None, description="Delay information")
    position: Optional[FlightPosition] = Field(None, description="Current position")
    baggage_claim: Optional[str] = Field(None, description="Baggage claim location")
    codeshare_flights: List[str] = Field(
        default_factory=list, description="Codeshare flight numbers"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional flight metadata"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "flight_number": "AF123",
                "airline": "Air France",
                "origin": {
                    "code": "CDG",
                    "name": "Charles de Gaulle Airport",
                    "city": "Paris",
                    "country": "France",
                    "timezone": "Europe/Paris",
                    "location": {"latitude": 49.0097, "longitude": 2.5478},
                    "terminals": ["1", "2A", "2B", "2C", "2D", "2E", "2F", "3"]
                },
                "destination": {
                    "code": "JFK",
                    "name": "John F. Kennedy International Airport",
                    "city": "New York",
                    "country": "United States",
                    "timezone": "America/New_York",
                    "location": {"latitude": 40.6413, "longitude": -73.7781},
                    "terminals": ["1", "2", "4", "5", "7", "8"]
                },
                "scheduled_departure": "2024-02-24T10:00:00Z",
                "scheduled_arrival": "2024-02-24T22:00:00Z",
                "status": "IN_AIR",
                "departure_gate": {"terminal": "2E", "number": "K45", "status": "ACTIVE"},
                "arrival_gate": {"terminal": "1", "number": "B20", "status": "ACTIVE"},
                "aircraft": {
                    "registration": "F-GSPS",
                    "type": "B777-300ER",
                    "airline": "Air France",
                    "capacity": 296
                },
                "position": {
                    "latitude": 45.0000,
                    "longitude": -40.0000,
                    "altitude": 35000,
                    "heading": 270,
                    "groundspeed": 480,
                    "timestamp": "2024-02-24T16:00:00Z"
                }
            }
        } 