import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import aiohttp
import structlog
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from ..models.flight import Flight, FlightStatus, FlightPosition
from ..utils.metrics import flight_tracker_metrics as metrics
from ..utils.cache import Cache


logger = structlog.get_logger(__name__)


class FlightTracker:
    def __init__(
        self,
        mongo_client: AsyncIOMotorClient,
        redis_client: Redis,
        vendor_configs: List[Dict[str, Any]],
        cache_ttl: int = 300,  # 5 minutes
    ):
        self.mongo = mongo_client
        self.redis = redis_client
        self.cache = Cache(redis_client)
        self.vendor_configs = vendor_configs
        self.cache_ttl = cache_ttl
        self.session: Optional[aiohttp.ClientSession] = None

    async def start(self):
        """Initialize the flight tracker service."""
        self.session = aiohttp.ClientSession()
        logger.info("Flight tracker service started")

    async def stop(self):
        """Cleanup resources."""
        if self.session:
            await self.session.close()
        logger.info("Flight tracker service stopped")

    async def get_flight(self, flight_number: str) -> Optional[Flight]:
        """Get flight information with caching."""
        cache_key = f"flight:{flight_number}"
        
        # Try cache first
        cached_flight = await self.cache.get(cache_key)
        if cached_flight:
            metrics.cache_hits.inc()
            return Flight.model_validate(cached_flight)

        metrics.cache_misses.inc()

        # Query from database
        flight_data = await self.mongo.flights.current.find_one({"flight_number": flight_number})
        if flight_data:
            flight = Flight.model_validate(flight_data)
            
            # Update cache
            await self.cache.set(cache_key, flight.model_dump(), self.cache_ttl)
            
            return flight

        # If not in database, fetch from vendors
        flight = await self._fetch_from_vendors(flight_number)
        if flight:
            # Store in database and cache
            await self.mongo.flights.current.update_one(
                {"flight_number": flight_number},
                {"$set": flight.model_dump()},
                upsert=True
            )
            await self.cache.set(cache_key, flight.model_dump(), self.cache_ttl)

        return flight

    async def _fetch_from_vendors(self, flight_number: str) -> Optional[Flight]:
        """Fetch flight information from multiple vendors with fallback."""
        tasks = []
        for vendor in self.vendor_configs:
            task = asyncio.create_task(
                self._fetch_from_vendor(flight_number, vendor),
                name=f"fetch_{vendor['name']}"
            )
            tasks.append(task)

        # Wait for first successful response or all failures
        flight_data = None
        start_time = datetime.utcnow()

        for completed in asyncio.as_completed(tasks):
            try:
                vendor_data = await completed
                if vendor_data:
                    flight_data = vendor_data
                    metrics.vendor_success.inc()
                    break
            except Exception as e:
                logger.error("Vendor fetch error", error=str(e))
                metrics.vendor_errors.inc()

        # Cancel remaining tasks
        for task in tasks:
            if not task.done():
                task.cancel()

        latency = (datetime.utcnow() - start_time).total_seconds()
        metrics.vendor_latency.observe(latency)

        return flight_data

    async def _fetch_from_vendor(
        self, flight_number: str, vendor_config: Dict[str, Any]
    ) -> Optional[Flight]:
        """Fetch flight information from a single vendor."""
        if not self.session:
            raise RuntimeError("Flight tracker service not started")

        url = vendor_config["url"].format(flight_number=flight_number)
        headers = vendor_config.get("headers", {})
        timeout = aiohttp.ClientTimeout(total=vendor_config.get("timeout", 5))

        try:
            async with self.session.get(url, headers=headers, timeout=timeout) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_vendor_response(data, vendor_config["name"])
                else:
                    logger.warning(
                        "Vendor request failed",
                        vendor=vendor_config["name"],
                        status=response.status
                    )
                    return None
        except Exception as e:
            logger.error(
                "Vendor request error",
                vendor=vendor_config["name"],
                error=str(e)
            )
            return None

    def _parse_vendor_response(self, data: Dict[str, Any], vendor: str) -> Optional[Flight]:
        """Parse vendor-specific response into Flight model."""
        try:
            # Implement vendor-specific parsing logic
            # This is a simplified example
            return Flight(
                flight_number=data["flight_number"],
                airline=data["airline"],
                origin=data["origin"],
                destination=data["destination"],
                scheduled_departure=data["scheduled_departure"],
                scheduled_arrival=data["scheduled_arrival"],
                status=FlightStatus(data["status"]),
                position=FlightPosition(**data["position"]) if "position" in data else None,
            )
        except Exception as e:
            logger.error("Vendor response parsing error", vendor=vendor, error=str(e))
            return None

    async def get_historical_data(
        self, flight_number: str, start_date: datetime, end_date: datetime
    ) -> List[Flight]:
        """Get historical flight data."""
        cursor = self.mongo.flights.historical.find({
            "flight_number": flight_number,
            "scheduled_departure": {"$gte": start_date, "$lte": end_date}
        }).sort("scheduled_departure", 1)

        return [Flight.model_validate(doc) async for doc in cursor]

    async def calculate_delay_estimate(self, flight: Flight) -> Optional[timedelta]:
        """Calculate estimated delay based on historical data and current conditions."""
        if flight.status not in [FlightStatus.DELAYED, FlightStatus.SCHEDULED]:
            return None

        # Get historical delays for this flight number
        one_month_ago = datetime.utcnow() - timedelta(days=30)
        historical_flights = await self.get_historical_data(
            flight.flight_number,
            one_month_ago,
            datetime.utcnow()
        )

        if not historical_flights:
            return None

        # Calculate average delay
        delays = []
        for hist_flight in historical_flights:
            if hist_flight.actual_arrival and hist_flight.scheduled_arrival:
                delay = hist_flight.actual_arrival - hist_flight.scheduled_arrival
                delays.append(delay.total_seconds() / 60)  # Convert to minutes

        if not delays:
            return None

        avg_delay = sum(delays) / len(delays)
        return timedelta(minutes=avg_delay)

    async def update_flight_status(
        self, flight_number: str, status: FlightStatus, metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Flight]:
        """Update flight status and notify subscribers."""
        flight = await self.get_flight(flight_number)
        if not flight:
            return None

        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        if metadata:
            update_data["metadata"] = {**flight.metadata, **metadata}

        # Update in database
        result = await self.mongo.flights.current.update_one(
            {"flight_number": flight_number},
            {"$set": update_data}
        )

        if result.modified_count > 0:
            # Invalidate cache
            await self.cache.delete(f"flight:{flight_number}")
            
            # Get updated flight
            updated_flight = await self.get_flight(flight_number)
            if updated_flight:
                metrics.status_updates.inc()
                logger.info(
                    "Flight status updated",
                    flight_number=flight_number,
                    old_status=flight.status,
                    new_status=status
                )
            return updated_flight

        return None 