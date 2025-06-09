import asyncio
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .models.flight import Flight, FlightStatus
from .models.subscription import WebhookSubscription, SubscriptionEvent
from .services.flight_tracker import FlightTracker
from .services.webhook_dispatcher import WebhookDispatcher
from .utils.logger import setup_logging, get_request_logger
from .utils.metrics import api_metrics


# Initialize logging
setup_logging("flight-info")
logger = get_request_logger()

# Create FastAPI app
app = FastAPI(
    title="Flight Info Service",
    description="Real-time flight status and schedule service for AeroFusion XR",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenTelemetry
FastAPIInstrumentor.instrument_app(app)


# Dependencies
async def get_mongo():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    try:
        yield client
    finally:
        client.close()


async def get_redis():
    redis = Redis(host="localhost", port=6379, decode_responses=True)
    try:
        yield redis
    finally:
        await redis.close()


async def get_flight_tracker(
    mongo: AsyncIOMotorClient = Depends(get_mongo),
    redis: Redis = Depends(get_redis),
):
    tracker = FlightTracker(
        mongo_client=mongo,
        redis_client=redis,
        vendor_configs=[
            {
                "name": "vendor1",
                "url": "https://api.vendor1.com/flights/{flight_number}",
                "headers": {"Authorization": "Bearer token1"},
            },
            {
                "name": "vendor2",
                "url": "https://api.vendor2.com/v1/flight-status/{flight_number}",
                "headers": {"X-API-Key": "token2"},
            },
        ],
    )
    await tracker.start()
    try:
        yield tracker
    finally:
        await tracker.stop()


async def get_webhook_dispatcher(
    mongo: AsyncIOMotorClient = Depends(get_mongo),
    redis: Redis = Depends(get_redis),
):
    dispatcher = WebhookDispatcher(mongo_client=mongo, redis_client=redis)
    await dispatcher.start()
    try:
        yield dispatcher
    finally:
        await dispatcher.stop()


# Middleware for metrics
@app.middleware("http")
async def metrics_middleware(request, call_next):
    start_time = datetime.utcnow()
    response = await call_next(request)
    duration = (datetime.utcnow() - start_time).total_seconds()

    api_metrics.requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()

    api_metrics.request_latency.labels(
        method=request.method,
        endpoint=request.url.path,
    ).observe(duration)

    return response


# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return JSONResponse(
        content=generate_latest().decode(),
        media_type=CONTENT_TYPE_LATEST,
    )


# Flight status endpoints
@app.get("/api/flights/{flight_number}", response_model=Flight)
async def get_flight_status(
    flight_number: str,
    tracker: FlightTracker = Depends(get_flight_tracker),
):
    """Get current flight status."""
    flight = await tracker.get_flight(flight_number)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight


@app.get("/api/flights", response_model=List[Flight])
async def search_flights(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    airline: Optional[str] = None,
    status: Optional[FlightStatus] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(default=50, le=100),
    tracker: FlightTracker = Depends(get_flight_tracker),
):
    """Search flights with filters."""
    # Build query
    query = {}
    if origin:
        query["origin.code"] = origin.upper()
    if destination:
        query["destination.code"] = destination.upper()
    if airline:
        query["airline"] = airline
    if status:
        query["status"] = status
    if from_time:
        query["scheduled_departure"] = {"$gte": from_time}
    if to_time:
        query.setdefault("scheduled_departure", {})["$lte"] = to_time

    # Execute query
    cursor = tracker.mongo.flights.current.find(query).limit(limit)
    flights = [Flight.model_validate(doc) async for doc in cursor]
    return flights


@app.get("/api/flights/{flight_number}/history")
async def get_flight_history(
    flight_number: str,
    days: int = Query(default=30, le=90),
    tracker: FlightTracker = Depends(get_flight_tracker),
):
    """Get historical flight data."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    flights = await tracker.get_historical_data(flight_number, start_date, end_date)
    return flights


# Webhook subscription endpoints
@app.post("/api/subscriptions", response_model=WebhookSubscription)
async def create_subscription(
    subscription: WebhookSubscription,
    dispatcher: WebhookDispatcher = Depends(get_webhook_dispatcher),
):
    """Create a new webhook subscription."""
    try:
        return await dispatcher.create_subscription(subscription)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/subscriptions/{subscription_id}")
async def delete_subscription(
    subscription_id: str,
    dispatcher: WebhookDispatcher = Depends(get_webhook_dispatcher),
):
    """Delete a webhook subscription."""
    success = await dispatcher.delete_subscription(subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"status": "deleted"}


@app.get("/api/subscriptions/{subscription_id}", response_model=WebhookSubscription)
async def get_subscription(
    subscription_id: str,
    dispatcher: WebhookDispatcher = Depends(get_webhook_dispatcher),
):
    """Get webhook subscription details."""
    subscription = await dispatcher.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription


# Calendar integration endpoints
@app.get("/api/flights/{flight_number}/calendar")
async def get_flight_calendar(
    flight_number: str,
    format: str = Query(default="ical", enum=["ical", "google"]),
    tracker: FlightTracker = Depends(get_flight_tracker),
):
    """Get flight schedule in calendar format."""
    flight = await tracker.get_flight(flight_number)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    if format == "ical":
        # Generate iCal format
        # Implementation details omitted for brevity
        return {"calendar_url": f"https://api.aerofusion.io/calendar/flight/{flight_number}.ics"}
    else:
        # Generate Google Calendar link
        # Implementation details omitted for brevity
        return {"calendar_url": f"https://calendar.google.com/calendar/render?action=TEMPLATE&text={flight_number}"}


# Background task to retry failed webhook deliveries
@app.post("/api/webhooks/retry")
async def retry_failed_webhooks(
    background_tasks: BackgroundTasks,
    dispatcher: WebhookDispatcher = Depends(get_webhook_dispatcher),
):
    """Retry failed webhook deliveries."""
    background_tasks.add_task(dispatcher.retry_failed_deliveries)
    return {"status": "retry_scheduled"}


# Event handlers
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Flight Info service")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Flight Info service") 