from prometheus_client import Counter, Histogram, Gauge


# Flight Tracker Metrics
class FlightTrackerMetrics:
    def __init__(self):
        self.cache_hits = Counter(
            "flight_tracker_cache_hits_total",
            "Number of cache hits when retrieving flight information"
        )
        self.cache_misses = Counter(
            "flight_tracker_cache_misses_total",
            "Number of cache misses when retrieving flight information"
        )
        self.vendor_success = Counter(
            "flight_tracker_vendor_success_total",
            "Number of successful vendor API calls",
            ["vendor"]
        )
        self.vendor_errors = Counter(
            "flight_tracker_vendor_errors_total",
            "Number of failed vendor API calls",
            ["vendor", "error_type"]
        )
        self.vendor_latency = Histogram(
            "flight_tracker_vendor_latency_seconds",
            "Latency of vendor API calls",
            ["vendor"],
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0)
        )
        self.status_updates = Counter(
            "flight_tracker_status_updates_total",
            "Number of flight status updates",
            ["status"]
        )
        self.active_flights = Gauge(
            "flight_tracker_active_flights",
            "Number of currently tracked flights"
        )
        self.delayed_flights = Gauge(
            "flight_tracker_delayed_flights",
            "Number of currently delayed flights"
        )
        self.avg_delay_minutes = Gauge(
            "flight_tracker_avg_delay_minutes",
            "Average delay in minutes for delayed flights"
        )


# Webhook Metrics
class WebhookMetrics:
    def __init__(self):
        self.subscriptions_created = Counter(
            "webhook_subscriptions_created_total",
            "Number of webhook subscriptions created"
        )
        self.subscriptions_deleted = Counter(
            "webhook_subscriptions_deleted_total",
            "Number of webhook subscriptions deleted"
        )
        self.webhook_success = Counter(
            "webhook_deliveries_success_total",
            "Number of successful webhook deliveries"
        )
        self.webhook_failures = Counter(
            "webhook_deliveries_failures_total",
            "Number of failed webhook deliveries",
            ["error_type"]
        )
        self.webhook_latency = Histogram(
            "webhook_delivery_latency_seconds",
            "Latency of webhook deliveries",
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0)
        )
        self.active_subscriptions = Gauge(
            "webhook_active_subscriptions",
            "Number of active webhook subscriptions"
        )
        self.dlq_size = Gauge(
            "webhook_dlq_size",
            "Number of messages in the webhook dead letter queue"
        )
        self.retry_success = Counter(
            "webhook_retry_success_total",
            "Number of successful webhook delivery retries"
        )
        self.retry_failures = Counter(
            "webhook_retry_failures_total",
            "Number of failed webhook delivery retries"
        )


# API Metrics
class APIMetrics:
    def __init__(self):
        self.requests_total = Counter(
            "api_requests_total",
            "Total number of API requests",
            ["method", "endpoint", "status"]
        )
        self.request_latency = Histogram(
            "api_request_latency_seconds",
            "API request latency",
            ["method", "endpoint"],
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0)
        )
        self.active_connections = Gauge(
            "api_active_connections",
            "Number of active API connections"
        )
        self.rate_limited_requests = Counter(
            "api_rate_limited_requests_total",
            "Number of rate-limited API requests",
            ["method", "endpoint"]
        )
        self.error_responses = Counter(
            "api_error_responses_total",
            "Number of API error responses",
            ["method", "endpoint", "error_type"]
        )


# Initialize metrics
flight_tracker_metrics = FlightTrackerMetrics()
webhook_metrics = WebhookMetrics()
api_metrics = APIMetrics() 