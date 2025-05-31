from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field, HttpUrl


class SubscriptionEvent(str, Enum):
    STATUS_CHANGE = "STATUS_CHANGE"
    DELAY = "DELAY"
    GATE_CHANGE = "GATE_CHANGE"
    POSITION_UPDATE = "POSITION_UPDATE"
    SCHEDULE_CHANGE = "SCHEDULE_CHANGE"
    BAGGAGE_CLAIM = "BAGGAGE_CLAIM"
    ALL = "ALL"


class WebhookStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    FAILED = "FAILED"
    DELETED = "DELETED"


class DeliveryAttempt(BaseModel):
    timestamp: datetime = Field(..., description="Attempt timestamp")
    status_code: int = Field(..., description="HTTP status code")
    response_body: Optional[str] = Field(None, description="Response body")
    error: Optional[str] = Field(None, description="Error message if failed")
    latency: float = Field(..., description="Request latency in seconds")


class WebhookSubscription(BaseModel):
    id: str = Field(..., description="Subscription ID")
    flight_numbers: List[str] = Field(..., description="List of flight numbers to monitor")
    callback_url: HttpUrl = Field(..., description="Webhook callback URL")
    events: List[SubscriptionEvent] = Field(..., description="Events to subscribe to")
    status: WebhookStatus = Field(default=WebhookStatus.ACTIVE)
    secret: str = Field(..., description="Webhook secret for signature verification")
    retry_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "max_attempts": 3,
            "initial_delay": 5,
            "max_delay": 300,
            "backoff_factor": 2.0,
        }
    )
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional filters for webhook delivery",
    )
    delivery_stats: Dict[str, int] = Field(
        default_factory=lambda: {
            "total_attempts": 0,
            "successful": 0,
            "failed": 0,
        }
    )
    last_delivery_attempt: Optional[DeliveryAttempt] = Field(
        None, description="Last delivery attempt details"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(None, description="Subscription expiration date")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "sub_123456",
                "flight_numbers": ["AF123", "KL456"],
                "callback_url": "https://api.example.com/webhooks/flight-updates",
                "events": ["STATUS_CHANGE", "DELAY", "GATE_CHANGE"],
                "status": "ACTIVE",
                "secret": "whsec_abcdef123456",
                "retry_config": {
                    "max_attempts": 3,
                    "initial_delay": 5,
                    "max_delay": 300,
                    "backoff_factor": 2.0,
                },
                "filters": {
                    "min_delay_minutes": 15,
                    "status_changes": ["DELAYED", "CANCELLED"],
                },
                "delivery_stats": {
                    "total_attempts": 10,
                    "successful": 8,
                    "failed": 2,
                },
                "last_delivery_attempt": {
                    "timestamp": "2024-02-24T12:00:00Z",
                    "status_code": 200,
                    "response_body": "OK",
                    "latency": 0.245,
                },
                "created_at": "2024-02-24T10:00:00Z",
                "updated_at": "2024-02-24T12:00:00Z",
                "expires_at": "2024-03-24T10:00:00Z",
            }
        } 