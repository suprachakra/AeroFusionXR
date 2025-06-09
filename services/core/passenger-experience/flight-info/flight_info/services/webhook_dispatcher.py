import asyncio
import hmac
import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import aiohttp
import structlog
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from ..models.subscription import (
    WebhookSubscription,
    WebhookStatus,
    SubscriptionEvent,
    DeliveryAttempt,
)
from ..models.flight import Flight, FlightStatus
from ..utils.metrics import webhook_metrics as metrics


logger = structlog.get_logger(__name__)


class WebhookDispatcher:
    def __init__(
        self,
        mongo_client: AsyncIOMotorClient,
        redis_client: Redis,
        dlq_name: str = "webhook_dlq",
        max_concurrent_deliveries: int = 50,
    ):
        self.mongo = mongo_client
        self.redis = redis_client
        self.dlq_name = dlq_name
        self.session: Optional[aiohttp.ClientSession] = None
        self.semaphore = asyncio.Semaphore(max_concurrent_deliveries)

    async def start(self):
        """Initialize the webhook dispatcher service."""
        self.session = aiohttp.ClientSession()
        logger.info("Webhook dispatcher service started")

    async def stop(self):
        """Cleanup resources."""
        if self.session:
            await self.session.close()
        logger.info("Webhook dispatcher service stopped")

    async def create_subscription(
        self, subscription: WebhookSubscription
    ) -> WebhookSubscription:
        """Create a new webhook subscription."""
        # Validate callback URL
        if not await self._validate_callback_url(subscription.callback_url):
            raise ValueError("Invalid callback URL")

        # Store in database
        result = await self.mongo.subscriptions.insert_one(subscription.model_dump())
        subscription.id = str(result.inserted_id)

        # Index subscription by flight numbers
        for flight_number in subscription.flight_numbers:
            await self.redis.sadd(f"flight_subs:{flight_number}", subscription.id)

        metrics.subscriptions_created.inc()
        logger.info(
            "Webhook subscription created",
            subscription_id=subscription.id,
            flight_numbers=subscription.flight_numbers,
        )

        return subscription

    async def delete_subscription(self, subscription_id: str) -> bool:
        """Delete a webhook subscription."""
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            return False

        # Remove from database
        result = await self.mongo.subscriptions.delete_one({"id": subscription_id})
        if result.deleted_count == 0:
            return False

        # Remove from flight number indices
        for flight_number in subscription.flight_numbers:
            await self.redis.srem(f"flight_subs:{flight_number}", subscription_id)

        metrics.subscriptions_deleted.inc()
        logger.info("Webhook subscription deleted", subscription_id=subscription_id)

        return True

    async def get_subscription(self, subscription_id: str) -> Optional[WebhookSubscription]:
        """Get a webhook subscription by ID."""
        doc = await self.mongo.subscriptions.find_one({"id": subscription_id})
        return WebhookSubscription.model_validate(doc) if doc else None

    async def get_subscriptions_for_flight(self, flight_number: str) -> List[WebhookSubscription]:
        """Get all active subscriptions for a flight number."""
        subscription_ids = await self.redis.smembers(f"flight_subs:{flight_number}")
        subscriptions = []

        for sub_id in subscription_ids:
            subscription = await self.get_subscription(sub_id.decode())
            if subscription and subscription.status == WebhookStatus.ACTIVE:
                subscriptions.append(subscription)

        return subscriptions

    def _should_notify(
        self, subscription: WebhookSubscription, event: SubscriptionEvent, flight: Flight
    ) -> bool:
        """Check if a subscription should be notified of an event."""
        if event not in subscription.events and SubscriptionEvent.ALL not in subscription.events:
            return False

        # Apply filters
        filters = subscription.filters
        if event == SubscriptionEvent.DELAY and "min_delay_minutes" in filters:
            if not flight.delay or flight.delay.duration < filters["min_delay_minutes"]:
                return False

        if event == SubscriptionEvent.STATUS_CHANGE and "status_changes" in filters:
            if flight.status not in filters["status_changes"]:
                return False

        return True

    def _generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload."""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    async def notify_flight_update(
        self, flight: Flight, event: SubscriptionEvent
    ) -> None:
        """Notify all subscribers about a flight update."""
        subscriptions = await self.get_subscriptions_for_flight(flight.flight_number)
        
        # Group subscriptions by callback URL for batching
        url_subscriptions: Dict[str, List[WebhookSubscription]] = {}
        for sub in subscriptions:
            if self._should_notify(sub, event, flight):
                url = str(sub.callback_url)
                if url not in url_subscriptions:
                    url_subscriptions[url] = []
                url_subscriptions[url].append(sub)

        # Process each batch
        tasks = []
        for url, subs in url_subscriptions.items():
            task = asyncio.create_task(
                self._deliver_batch(url, subs, flight, event)
            )
            tasks.append(task)

        # Wait for all deliveries to complete
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_batch(
        self,
        url: str,
        subscriptions: List[WebhookSubscription],
        flight: Flight,
        event: SubscriptionEvent,
    ) -> None:
        """Deliver a batch of notifications to the same URL."""
        async with self.semaphore:
            payload = {
                "event": event,
                "timestamp": datetime.utcnow().isoformat(),
                "flight": flight.model_dump(),
                "subscription_ids": [sub.id for sub in subscriptions]
            }
            payload_json = json.dumps(payload)

            # Generate signatures for each subscription
            signatures = {
                sub.id: self._generate_signature(payload_json, sub.secret)
                for sub in subscriptions
            }

            headers = {
                "Content-Type": "application/json",
                "User-Agent": "AeroFusion-Webhook/1.0",
                "X-Event-Type": event,
                "X-Webhook-Signatures": json.dumps(signatures)
            }

            start_time = time.time()
            try:
                async with self.session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    latency = time.time() - start_time
                    metrics.webhook_latency.observe(latency)

                    response_body = await response.text()
                    success = 200 <= response.status < 300

                    delivery_attempt = DeliveryAttempt(
                        timestamp=datetime.utcnow(),
                        status_code=response.status,
                        response_body=response_body,
                        latency=latency
                    )

                    await self._update_delivery_stats(
                        subscriptions,
                        success,
                        delivery_attempt
                    )

                    if not success:
                        await self._handle_delivery_failure(
                            subscriptions,
                            payload,
                            delivery_attempt
                        )
                    else:
                        metrics.webhook_success.inc()
                        logger.info(
                            "Webhook delivery successful",
                            url=url,
                            subscription_ids=[sub.id for sub in subscriptions],
                            latency=latency
                        )

            except Exception as e:
                latency = time.time() - start_time
                delivery_attempt = DeliveryAttempt(
                    timestamp=datetime.utcnow(),
                    status_code=0,
                    error=str(e),
                    latency=latency
                )

                await self._handle_delivery_failure(
                    subscriptions,
                    payload,
                    delivery_attempt
                )

    async def _update_delivery_stats(
        self,
        subscriptions: List[WebhookSubscription],
        success: bool,
        attempt: DeliveryAttempt
    ) -> None:
        """Update delivery statistics for subscriptions."""
        for sub in subscriptions:
            update = {
                "$inc": {
                    "delivery_stats.total_attempts": 1,
                    f"delivery_stats.{'successful' if success else 'failed'}": 1
                },
                "$set": {
                    "last_delivery_attempt": attempt.model_dump(),
                    "updated_at": datetime.utcnow()
                }
            }

            await self.mongo.subscriptions.update_one(
                {"id": sub.id},
                update
            )

    async def _handle_delivery_failure(
        self,
        subscriptions: List[WebhookSubscription],
        payload: Dict[str, Any],
        attempt: DeliveryAttempt
    ) -> None:
        """Handle webhook delivery failure."""
        metrics.webhook_failures.inc()

        # Add to dead letter queue
        dlq_item = {
            "payload": payload,
            "subscription_ids": [sub.id for sub in subscriptions],
            "attempt": attempt.model_dump(),
            "timestamp": datetime.utcnow()
        }
        await self.mongo[self.dlq_name].insert_one(dlq_item)

        # Update subscription status if max retries exceeded
        for sub in subscriptions:
            if sub.delivery_stats["failed"] >= sub.retry_config["max_attempts"]:
                await self.mongo.subscriptions.update_one(
                    {"id": sub.id},
                    {
                        "$set": {
                            "status": WebhookStatus.FAILED,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )

        logger.error(
            "Webhook delivery failed",
            subscription_ids=[sub.id for sub in subscriptions],
            error=attempt.error,
            status_code=attempt.status_code
        )

    async def _validate_callback_url(self, url: str) -> bool:
        """Validate that a callback URL is reachable."""
        try:
            async with self.session.head(
                url,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                return response.status < 400
        except Exception:
            return False

    async def retry_failed_deliveries(self) -> None:
        """Retry failed webhook deliveries from the DLQ."""
        while True:
            dlq_item = await self.mongo[self.dlq_name].find_one_and_delete({})
            if not dlq_item:
                break

            subscriptions = []
            for sub_id in dlq_item["subscription_ids"]:
                sub = await self.get_subscription(sub_id)
                if sub and sub.status == WebhookStatus.ACTIVE:
                    subscriptions.append(sub)

            if subscriptions:
                url = str(subscriptions[0].callback_url)
                await self._deliver_batch(
                    url,
                    subscriptions,
                    Flight.model_validate(dlq_item["payload"]["flight"]),
                    SubscriptionEvent(dlq_item["payload"]["event"])
                ) 