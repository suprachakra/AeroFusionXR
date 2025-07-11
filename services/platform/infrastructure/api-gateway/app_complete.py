"""
AeroFusionXR API Gateway Service
Enterprise-grade API Gateway with comprehensive features for aviation XR platform.

Key Features:
- JWT Authentication & Role-based Authorization
- Circuit Breaker Pattern for Fault Tolerance  
- Redis-backed Rate Limiting with Sliding Windows
- Dynamic Service Discovery & Health Monitoring
- Distributed Tracing with OpenTelemetry
- Comprehensive Prometheus Metrics
- Request/Response Transformation
- Security Headers & CORS Management
- Graceful Error Handling & Recovery
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse

import aiohttp
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Request, Response, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
import uvicorn
from opentelemetry import trace, metrics
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import jwt
from jwt.exceptions import InvalidTokenError
import hashlib
import os
from contextlib import asynccontextmanager

# ================================
# CONFIGURATION & SETUP
# ================================

CONFIG = {
    "SERVICE_NAME": os.getenv("SERVICE_NAME", "api-gateway"),
    "VERSION": os.getenv("API_VERSION", "1.0.0"),
    "PORT": int(os.getenv("PORT", 8000)),
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "REDIS_URL": os.getenv("REDIS_URL", "redis://redis:6379"),
    "JWT_SECRET": os.getenv("JWT_SECRET", "your-super-secret-jwt-key"),
    "JWT_ALGORITHM": os.getenv("JWT_ALGORITHM", "HS256"),
    "JWT_EXPIRY_HOURS": int(os.getenv("JWT_EXPIRY_HOURS", 24)),
    "RATE_LIMIT_REQUESTS": int(os.getenv("RATE_LIMIT_REQUESTS", 1000)),
    "RATE_LIMIT_WINDOW": int(os.getenv("RATE_LIMIT_WINDOW", 3600)),
    "CIRCUIT_BREAKER_FAILURES": int(os.getenv("CIRCUIT_BREAKER_FAILURES", 5)),
    "CIRCUIT_BREAKER_TIMEOUT": int(os.getenv("CIRCUIT_BREAKER_TIMEOUT", 30)),
    "REQUEST_TIMEOUT": int(os.getenv("REQUEST_TIMEOUT", 30)),
    "OTEL_ENDPOINT": os.getenv("OTEL_ENDPOINT", "http://otel-collector:4317"),
}

# Configure structured logging with correlation IDs
logging.basicConfig(
    level=getattr(logging, CONFIG["LOG_LEVEL"]),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize OpenTelemetry with comprehensive resource attributes
resource = Resource.create({
    "service.name": CONFIG["SERVICE_NAME"],
    "service.version": CONFIG["VERSION"],
    "service.instance.id": os.getenv("HOSTNAME", "localhost"),
    "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    "telemetry.sdk.name": "opentelemetry",
    "telemetry.sdk.language": "python"
})

trace.set_tracer_provider(TracerProvider(resource=resource))
tracer = trace.get_tracer(__name__)

# Configure OTLP exporter with retry logic
otlp_exporter = OTLPSpanExporter(
    endpoint=CONFIG["OTEL_ENDPOINT"],
    insecure=True
)
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# ================================
# PROMETHEUS METRICS
# ================================

METRICS = {
    "requests_total": Counter(
        "api_gateway_requests_total",
        "Total number of requests processed",
        ["method", "path", "status_code", "service"]
    ),
    "request_duration": Histogram(
        "api_gateway_request_duration_seconds",
        "Request processing duration in seconds",
        ["method", "path", "service"],
        buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]
    ),
    "service_health": Gauge(
        "api_gateway_service_health",
        "Health status of backend services (1=healthy, 0=unhealthy)",
        ["service"]
    ),
    "circuit_breaker_state": Gauge(
        "api_gateway_circuit_breaker_state",
        "Circuit breaker state (0=closed, 1=open, 2=half_open)",
        ["service"]
    ),
    "rate_limit_hits": Counter(
        "api_gateway_rate_limit_hits_total",
        "Number of rate limit violations",
        ["user_id", "endpoint"]
    ),
    "jwt_validations": Counter(
        "api_gateway_jwt_validations_total",
        "JWT validation attempts by status",
        ["status"]
    ),
    "active_connections": Gauge(
        "api_gateway_active_connections",
        "Number of active connections to backend services"
    )
}

# ================================
# DATA MODELS
# ================================

class ServiceConfig(BaseModel):
    """Configuration for backend service registration"""
    name: str
    url: str
    health_endpoint: str = "/health"
    timeout: int = 30
    max_retries: int = 3
    circuit_breaker_enabled: bool = True
    weight: int = 1  # For load balancing

class UserClaims(BaseModel):
    """JWT token claims structure with aviation-specific fields"""
    user_id: str
    email: str
    roles: List[str]
    passenger_id: Optional[str] = None
    airline_code: Optional[str] = None
    flight_number: Optional[str] = None
    frequent_flyer_tier: Optional[str] = None
    exp: int

class RateLimitConfig(BaseModel):
    """Rate limiting configuration per endpoint/role"""
    requests_per_hour: int
    burst_limit: int
    window_size: int = 3600

# ================================
# GLOBAL STATE MANAGEMENT
# ================================

class ApplicationState:
    """Thread-safe global application state"""
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.http_session: Optional[aiohttp.ClientSession] = None
        self.services: Dict[str, ServiceConfig] = {}
        self.circuit_breakers: Dict[str, "CircuitBreaker"] = {}
        self.startup_time = datetime.utcnow()
        self.health_check_task: Optional[asyncio.Task] = None

app_state = ApplicationState()

# ================================
# CIRCUIT BREAKER IMPLEMENTATION
# ================================

class CircuitBreaker:
    """
    High-performance circuit breaker with configurable failure detection.
    
    States:
    - CLOSED: Normal operation, requests flow through
    - OPEN: Service degraded, fail-fast mode active
    - HALF_OPEN: Testing recovery, limited requests allowed
    """
    
    def __init__(self, service_name: str, failure_threshold: int = 5, timeout: int = 30):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.last_success_time = None
        self.state = "CLOSED"
        self._lock = asyncio.Lock()
        
    async def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with tracer.start_as_current_span(f"circuit_breaker_{self.service_name}") as span:
            span.set_attribute("circuit_breaker.service", self.service_name)
            span.set_attribute("circuit_breaker.state", self.state)
            span.set_attribute("circuit_breaker.failure_count", self.failure_count)
            
            async with self._lock:
                if self.state == "OPEN":
                    if self._should_attempt_reset():
                        self.state = "HALF_OPEN"
                        logger.info(f"Circuit breaker for {self.service_name} entering HALF_OPEN state")
                    else:
                        span.set_attribute("circuit_breaker.fast_fail", True)
                        raise HTTPException(
                            status_code=503,
                            detail=f"Service {self.service_name} is currently unavailable (circuit breaker open)"
                        )
                
                elif self.state == "HALF_OPEN":
                    # Allow limited requests in half-open state
                    if self.success_count >= 3:  # Reset after 3 successful calls
                        await self._reset_breaker()
            
            try:
                start_time = time.time()
                result = await func(*args, **kwargs)
                
                # Record success metrics
                duration = time.time() - start_time
                span.set_attribute("circuit_breaker.call_duration", duration)
                span.set_attribute("circuit_breaker.call_success", True)
                
                await self._on_success()
                return result
                
            except Exception as e:
                span.record_exception(e)
                span.set_attribute("circuit_breaker.call_success", False)
                await self._on_failure()
                raise
    
    def _should_attempt_reset(self) -> bool:
        """Determine if circuit breaker should attempt reset"""
        return (
            self.last_failure_time and
            time.time() - self.last_failure_time >= self.timeout
        )
    
    async def _on_success(self):
        """Handle successful request with state management"""
        async with self._lock:
            self.last_success_time = time.time()
            
            if self.state == "HALF_OPEN":
                self.success_count += 1
                if self.success_count >= 3:
                    await self._reset_breaker()
            elif self.state == "CLOSED":
                # Reset failure count on success in closed state
                self.failure_count = max(0, self.failure_count - 1)
        
        await self._update_metrics()
    
    async def _on_failure(self):
        """Handle failed request with state transitions"""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            self.success_count = 0  # Reset success count on failure
            
            if self.failure_count >= self.failure_threshold and self.state == "CLOSED":
                self.state = "OPEN"
                logger.warning(
                    f"Circuit breaker OPENED for {self.service_name} "
                    f"after {self.failure_count} failures"
                )
            elif self.state == "HALF_OPEN":
                self.state = "OPEN"
                logger.warning(f"Circuit breaker returned to OPEN state for {self.service_name}")
        
        await self._update_metrics()
    
    async def _reset_breaker(self):
        """Reset circuit breaker to healthy state"""
        self.state = "CLOSED"
        self.failure_count = 0
        self.success_count = 0
        logger.info(f"Circuit breaker RESET for {self.service_name}")
    
    async def _update_metrics(self):
        """Update Prometheus metrics for monitoring"""
        state_mapping = {"CLOSED": 0, "OPEN": 1, "HALF_OPEN": 2}
        METRICS["circuit_breaker_state"].labels(
            service=self.service_name
        ).set(state_mapping[self.state])

# ================================
# AUTHENTICATION & AUTHORIZATION  
# ================================

security = HTTPBearer()

async def verify_jwt_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserClaims:
    """
    Comprehensive JWT token verification with blacklist checking.
    
    Validates:
    - Token signature and expiration
    - Required claims structure
    - Token blacklist status (for logout/revocation)
    - User role permissions
    """
    with tracer.start_as_current_span("jwt_verification") as span:
        try:
            # Decode and verify JWT token
            payload = jwt.decode(
                credentials.credentials,
                CONFIG["JWT_SECRET"],
                algorithms=[CONFIG["JWT_ALGORITHM"]]
            )
            
            # Validate claims structure
            user_claims = UserClaims(**payload)
            
            # Set tracing attributes for observability
            span.set_attribute("user.id", user_claims.user_id)
            span.set_attribute("user.roles", ",".join(user_claims.roles))
            span.set_attribute("user.passenger_id", user_claims.passenger_id or "")
            span.set_attribute("user.airline_code", user_claims.airline_code or "")
            
            # Check token blacklist (for logout/security revocation)
            token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
            is_blacklisted = await app_state.redis.exists(f"token_blacklist:{token_hash}")
            
            if is_blacklisted:
                span.set_attribute("token.blacklisted", True)
                METRICS["jwt_validations"].labels(status="blacklisted").inc()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been revoked",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            # Validate token expiration with buffer for clock skew
            current_time = time.time()
            if current_time > user_claims.exp + 30:  # 30 second buffer
                span.set_attribute("token.expired", True)
                METRICS["jwt_validations"].labels(status="expired").inc()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            METRICS["jwt_validations"].labels(status="valid").inc()
            return user_claims
            
        except InvalidTokenError as e:
            span.record_exception(e)
            span.set_attribute("token.invalid", True)
            METRICS["jwt_validations"].labels(status="invalid").inc()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except ValidationError as e:
            span.record_exception(e)
            span.set_attribute("token.malformed", True)
            METRICS["jwt_validations"].labels(status="malformed").inc()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed token claims",
                headers={"WWW-Authenticate": "Bearer"}
            )

def require_roles(required_roles: List[str]):
    """
    Role-based access control decorator with aviation-specific permissions.
    
    Supports hierarchical roles:
    - admin: Full system access
    - staff: Airport/airline staff operations
    - premium: Premium passenger features  
    - passenger: Basic passenger features
    """
    def role_checker(user_claims: UserClaims = Depends(verify_jwt_token)):
        user_roles_set = set(user_claims.roles)
        required_roles_set = set(required_roles)
        
        # Admin bypass for all operations
        if "admin" in user_roles_set:
            return user_claims
            
        # Check role intersection
        if not user_roles_set.intersection(required_roles_set):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}"
            )
        return user_claims
    return role_checker

# ================================
# RATE LIMITING
# ================================

async def check_rate_limit(request: Request, user_claims: UserClaims = None) -> bool:
    """
    Advanced rate limiting with Redis sliding window algorithm.
    
    Features:
    - Per-user and per-IP rate limiting
    - Role-based limit tiers (premium users get higher limits)
    - Endpoint-specific limits
    - Sliding window for smooth rate limiting
    - Graceful degradation during Redis failures
    """
    with tracer.start_as_current_span("rate_limiting") as span:
        try:
            # Determine rate limiting key and limits based on user context
            if user_claims:
                # Authenticated user rate limiting
                identifier = f"user:{user_claims.user_id}"
                
                # Role-based rate limit multipliers
                if "admin" in user_claims.roles:
                    rate_multiplier = 10  # Admins get 10x limits
                elif "staff" in user_claims.roles:
                    rate_multiplier = 5   # Staff get 5x limits
                elif "premium" in user_claims.roles or user_claims.frequent_flyer_tier in ["gold", "platinum"]:
                    rate_multiplier = 3   # Premium users get 3x limits
                else:
                    rate_multiplier = 1   # Standard passenger limits
            else:
                # IP-based rate limiting for unauthenticated requests
                client_ip = request.client.host
                identifier = f"ip:{client_ip}"
                rate_multiplier = 0.5  # Stricter limits for unauthenticated
            
            # Calculate effective rate limits
            base_limit = CONFIG["RATE_LIMIT_REQUESTS"]
            effective_limit = int(base_limit * rate_multiplier)
            window_seconds = CONFIG["RATE_LIMIT_WINDOW"]
            
            # Redis sliding window implementation
            endpoint = request.url.path
            rate_key = f"rate_limit:{identifier}:{endpoint}"
            
            current_time = time.time()
            window_start = current_time - window_seconds
            
            # Use Redis pipeline for atomic operations
            pipeline = app_state.redis.pipeline()
            
            # Remove expired entries outside the window
            pipeline.zremrangebyscore(rate_key, 0, window_start)
            
            # Count current requests in window
            pipeline.zcard(rate_key)
            
            # Add current request with timestamp as score
            pipeline.zadd(rate_key, {f"{current_time}:{os.urandom(8).hex()}": current_time})
            
            # Set key expiration
            pipeline.expire(rate_key, window_seconds + 60)  # Extra buffer for cleanup
            
            # Execute pipeline
            results = await pipeline.execute()
            current_requests = results[1] if len(results) > 1 else 0
            
            # Update tracing and metrics
            span.set_attribute("rate_limit.identifier", identifier)
            span.set_attribute("rate_limit.endpoint", endpoint)
            span.set_attribute("rate_limit.current_requests", current_requests)
            span.set_attribute("rate_limit.effective_limit", effective_limit)
            span.set_attribute("rate_limit.window_seconds", window_seconds)
            
            if current_requests > effective_limit:
                # Rate limit exceeded
                span.set_attribute("rate_limit.exceeded", True)
                
                if user_claims:
                    METRICS["rate_limit_hits"].labels(
                        user_id=user_claims.user_id,
                        endpoint=endpoint
                    ).inc()
                
                logger.warning(
                    f"Rate limit exceeded for {identifier} on {endpoint}: "
                    f"{current_requests}/{effective_limit} requests"
                )
                return False
            
            return True
            
        except redis.RedisError as e:
            # Graceful degradation: allow requests if Redis is unavailable
            span.record_exception(e)
            span.set_attribute("rate_limit.redis_error", True)
            logger.warning(f"Redis error during rate limiting, allowing request: {e}")
            return True
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Unexpected error in rate limiting: {e}")
            return True  # Fail open for availability

# ================================
# SERVICE DISCOVERY & HEALTH MONITORING
# ================================

async def discover_services():
    """
    Initialize service registry with comprehensive health monitoring.
    In production, this could integrate with Consul, etcd, or Kubernetes service discovery.
    """
    logger.info("Initializing service discovery...")
    
    # Service registry configuration
    # TODO: Replace with dynamic service discovery (Consul/K8s service discovery)
    service_configs = {
        "ai-concierge": ServiceConfig(
            name="ai-concierge",
            url="http://ai-concierge:8000",
            health_endpoint="/health",
            timeout=30,
            max_retries=3
        ),
        "flight-info": ServiceConfig(
            name="flight-info", 
            url="http://flight-info:8000",
            health_endpoint="/health",
            timeout=15,
            max_retries=2
        ),
        "wayfinding": ServiceConfig(
            name="wayfinding",
            url="http://wayfinding:8000", 
            health_endpoint="/health",
            timeout=20,
            max_retries=3
        ),
        "baggage-tracker": ServiceConfig(
            name="baggage-tracker",
            url="http://baggage-tracker:8000",
            health_endpoint="/health",
            timeout=25,
            max_retries=2
        ),
        "commerce": ServiceConfig(
            name="commerce",
            url="http://commerce:8000",
            health_endpoint="/health",
            timeout=30,
            max_retries=3
        ),
        "booking": ServiceConfig(
            name="booking",
            url="http://booking:8000", 
            health_endpoint="/health",
            timeout=45,  # Booking operations may take longer
            max_retries=2
        )
    }
    
    app_state.services = service_configs
    
    # Initialize circuit breakers for each service
    for service_name in service_configs:
        app_state.circuit_breakers[service_name] = CircuitBreaker(
            service_name=service_name,
            failure_threshold=CONFIG["CIRCUIT_BREAKER_FAILURES"],
            timeout=CONFIG["CIRCUIT_BREAKER_TIMEOUT"]
        )
    
    logger.info(f"Registered {len(service_configs)} services with circuit breakers")
    
    # Start continuous health monitoring
    app_state.health_check_task = asyncio.create_task(health_monitor_loop())

async def health_monitor_loop():
    """
    Background task for continuous service health monitoring.
    Runs health checks every 30 seconds and updates metrics.
    """
    logger.info("Starting continuous health monitoring...")
    
    while True:
        try:
            await perform_health_checks()
            await asyncio.sleep(30)  # Health check interval
        except asyncio.CancelledError:
            logger.info("Health monitoring task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in health monitoring loop: {e}")
            await asyncio.sleep(60)  # Wait longer on error

async def perform_health_checks():
    """Perform parallel health checks on all registered services"""
    with tracer.start_as_current_span("health_checks") as span:
        health_tasks = []
        
        for service_name, service_config in app_state.services.items():
            task = asyncio.create_task(
                check_service_health(service_name, service_config)
            )
            health_tasks.append(task)
        
        if health_tasks:
            # Execute all health checks in parallel
            results = await asyncio.gather(*health_tasks, return_exceptions=True)
            
            # Log any health check exceptions
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    service_name = list(app_state.services.keys())[i]
                    logger.error(f"Health check exception for {service_name}: {result}")
        
        span.set_attribute("health_checks.services_checked", len(health_tasks))

async def check_service_health(service_name: str, service_config: ServiceConfig):
    """
    Perform individual service health check with timeout and error handling.
    Updates Prometheus metrics based on health status.
    """
    with tracer.start_as_current_span(f"health_check_{service_name}") as span:
        try:
            health_url = f"{service_config.url}{service_config.health_endpoint}"
            span.set_attribute("health_check.url", health_url)
            
            # Perform health check with timeout
            async with app_state.http_session.get(
                health_url,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                span.set_attribute("health_check.status_code", response.status)
                
                if response.status == 200:
                    # Service is healthy
                    METRICS["service_health"].labels(service=service_name).set(1)
                    span.set_attribute("health_check.healthy", True)
                    logger.debug(f"âœ“ Service {service_name} is healthy")
                else:
                    # Service returned non-200 status
                    METRICS["service_health"].labels(service=service_name).set(0)
                    span.set_attribute("health_check.healthy", False)
                    logger.warning(
                        f"âœ— Service {service_name} health check failed: "
                        f"HTTP {response.status}"
                    )
                    
        except asyncio.TimeoutError:
            # Health check timeout
            METRICS["service_health"].labels(service=service_name).set(0)
            span.set_attribute("health_check.timeout", True)
            logger.warning(f"âœ— Service {service_name} health check timed out")
            
        except Exception as e:
            # Other health check errors
            METRICS["service_health"].labels(service=service_name).set(0)
            span.record_exception(e)
            span.set_attribute("health_check.error", str(e))
            logger.error(f"âœ— Service {service_name} health check failed: {e}")

# ================================
# REQUEST ROUTING & PROXYING
# ================================

async def route_request(
    service_name: str,
    path: str,
    method: str,
    headers: dict,
    query_params: dict,
    body: bytes = None
) -> tuple[int, dict, bytes]:
    """
    Route request to backend service with comprehensive error handling.
    
    Features:
    - Circuit breaker protection
    - Request/response header filtering
    - Correlation ID propagation
    - Retry logic with exponential backoff
    - Comprehensive tracing and metrics
    """
    if service_name not in app_state.services:
        raise HTTPException(
            status_code=404,
            detail=f"Service '{service_name}' not found in registry"
        )
    
    service_config = app_state.services[service_name]
    circuit_breaker = app_state.circuit_breakers[service_name]
    
    async def make_request():
        """Internal function to make the actual HTTP request"""
        target_url = f"{service_config.url}{path}"
        
        # Filter out hop-by-hop headers that shouldn't be forwarded
        hop_by_hop_headers = {
            'connection', 'keep-alive', 'proxy-authenticate',
            'proxy-authorization', 'te', 'trailers', 'transfer-encoding',
            'upgrade', 'host', 'content-length'
        }
        
        # Prepare headers for forwarding
        filtered_headers = {
            k: v for k, v in headers.items()
            if k.lower() not in hop_by_hop_headers
        }
        
        # Add gateway-specific headers
        correlation_id = headers.get('x-correlation-id', f"gw-{int(time.time() * 1000)}")
        filtered_headers.update({
            'x-correlation-id': correlation_id,
            'x-forwarded-by': 'aerofusion-api-gateway',
            'x-forwarded-proto': 'http',  # Update based on actual protocol
            'x-request-id': correlation_id,
            'user-agent': f"AeroFusionXR-Gateway/{CONFIG['VERSION']}"
        })
        
        with tracer.start_as_current_span("backend_request") as span:
            span.set_attribute("http.method", method)
            span.set_attribute("http.url", target_url)
            span.set_attribute("service.name", service_name)
            span.set_attribute("correlation.id", correlation_id)
            
            try:
                # Make request to backend service
                async with app_state.http_session.request(
                    method=method,
                    url=target_url,
                    headers=filtered_headers,
                    params=query_params,
                    data=body,
                    timeout=aiohttp.ClientTimeout(total=service_config.timeout)
                ) as response:
                    
                    # Read response
                    response_body = await response.read()
                    response_headers = dict(response.headers)
                    
                    # Update tracing attributes
                    span.set_attribute("http.status_code", response.status)
                    span.set_attribute("response.size_bytes", len(response_body))
                    
                    # Check for application-level errors
                    if response.status >= 500:
                        span.set_status(trace.Status(trace.StatusCode.ERROR))
                        raise aiohttp.ClientResponseError(
                            request_info=response.request_info,
                            history=response.history,
                            status=response.status,
                            message=f"Backend service error: {response.status}"
                        )
                    
                    return response.status, response_headers, response_body
                    
            except asyncio.TimeoutError as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR))
                raise HTTPException(
                    status_code=504,
                    detail=f"Gateway timeout: Service {service_name} did not respond within {service_config.timeout}s"
                )
            except aiohttp.ClientError as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR))
                raise HTTPException(
                    status_code=502,
                    detail=f"Bad Gateway: Communication error with {service_name}"
                )
    
    # Execute request with circuit breaker protection
    return await circuit_breaker.call(make_request)

# ================================
# FASTAPI APPLICATION SETUP
# ================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    # Startup
    logger.info("Starting API Gateway...")
    
    # Initialize Redis connection
    app_state.redis = redis.from_url(CONFIG["REDIS_URL"])
    await app_state.redis.ping()  # Test connection
    logger.info("Redis connection established")
    
    # Initialize HTTP session with connection pooling
    connector = aiohttp.TCPConnector(
        limit=100,  # Total connection pool size
        limit_per_host=20,  # Per-host connection limit
        ttl_dns_cache=300,  # DNS cache TTL
        use_dns_cache=True,
    )
    
    app_state.http_session = aiohttp.ClientSession(
        connector=connector,
        timeout=aiohttp.ClientTimeout(total=CONFIG["REQUEST_TIMEOUT"])
    )
    logger.info("HTTP session initialized")
    
    # Discover services and start health monitoring
    await discover_services()
    logger.info("Service discovery completed")
    
    logger.info("API Gateway startup completed")
    
    yield
    
    # Shutdown
    logger.info("Shutting down API Gateway...")
    
    if app_state.redis:
        await app_state.redis.close()
    
    if app_state.http_session:
        await app_state.http_session.close()
    
    logger.info("API Gateway shutdown completed")

# Create FastAPI application with comprehensive configuration
app = FastAPI(
    title="AeroFusionXR API Gateway",
    description="Enterprise-grade API Gateway for Aviation XR Platform",
    version=CONFIG["VERSION"],
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Add comprehensive middleware stack
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-correlation-id", "x-process-time"]
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
)

# Instrument with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)
AioHttpClientInstrumentor().instrument()

# ================================
# API ENDPOINTS
# ================================

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """
    Comprehensive request middleware for:
    - Request correlation tracking
    - Performance timing
    - Security headers
    - Request/response logging
    """
    start_time = time.time()
    correlation_id = request.headers.get('x-correlation-id', f"gw-{int(start_time * 1000)}")
    
    with tracer.start_as_current_span("http_request") as span:
        span.set_attribute("http.method", request.method)
        span.set_attribute("http.url", str(request.url))
        span.set_attribute("http.correlation_id", correlation_id)
        span.set_attribute("http.user_agent", request.headers.get("user-agent", ""))
        
        # Add correlation ID to request state
        request.state.correlation_id = correlation_id
        
        try:
            response = await call_next(request)
            
            # Add security and performance headers
            response.headers["x-correlation-id"] = correlation_id
            response.headers["x-process-time"] = str(time.time() - start_time)
            response.headers["x-content-type-options"] = "nosniff"
            response.headers["x-frame-options"] = "DENY"
            response.headers["x-xss-protection"] = "1; mode=block"
            response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
            
            # Update metrics
            METRICS["requests_total"].labels(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                service="api-gateway"
            ).inc()
            
            METRICS["request_duration"].labels(
                method=request.method,
                path=request.url.path,
                service="api-gateway"
            ).observe(time.time() - start_time)
            
            span.set_attribute("http.status_code", response.status_code)
            
            return response
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR))
            
            # Update error metrics
            METRICS["requests_total"].labels(
                method=request.method,
                path=request.url.path,
                status_code=500,
                service="api-gateway"
            ).inc()
            
            raise

@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint.
    Returns detailed status of gateway and all backend services.
    """
    with tracer.start_as_current_span("health_check") as span:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": CONFIG["VERSION"],
            "uptime": str(datetime.utcnow() - app_state.startup_time),
            "services": {},
            "components": {
                "redis": "unknown",
                "http_session": "unknown"
            }
        }
        
        # Check Redis connection
        try:
            await app_state.redis.ping()
            health_status["components"]["redis"] = "healthy"
        except Exception as e:
            health_status["components"]["redis"] = f"unhealthy: {str(e)}"
            health_status["status"] = "degraded"
        
        # Check HTTP session
        if app_state.http_session and not app_state.http_session.closed:
            health_status["components"]["http_session"] = "healthy"
        else:
            health_status["components"]["http_session"] = "unhealthy"
            health_status["status"] = "degraded"
        
        # Check backend services
        for service_name, service_config in app_state.services.items():
            try:
                circuit_breaker = app_state.circuit_breakers[service_name]
                health_status["services"][service_name] = {
                    "status": "healthy" if circuit_breaker.state == "CLOSED" else "unhealthy",
                    "circuit_breaker_state": circuit_breaker.state,
                    "failure_count": circuit_breaker.failure_count,
                    "url": service_config.url
                }
                
                if circuit_breaker.state != "CLOSED":
                    health_status["status"] = "degraded"
                    
            except Exception as e:
                health_status["services"][service_name] = {
                    "status": "unknown",
                    "error": str(e)
                }
                health_status["status"] = "degraded"
        
        span.set_attribute("health.status", health_status["status"])
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        return JSONResponse(content=health_status, status_code=status_code)

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type="text/plain")

@app.get("/info")
async def service_info():
    """Service information and configuration"""
    return {
        "name": CONFIG["SERVICE_NAME"],
        "version": CONFIG["VERSION"],
        "environment": os.getenv("ENVIRONMENT", "development"),
        "build_time": os.getenv("BUILD_TIME", "unknown"),
        "git_commit": os.getenv("GIT_COMMIT", "unknown"),
        "services": list(app_state.services.keys()),
        "features": [
            "jwt_authentication",
            "rate_limiting",
            "circuit_breaker",
            "service_discovery",
            "distributed_tracing",
            "metrics_collection",
            "health_monitoring"
        ]
    }

# ================================
# DYNAMIC ROUTING ENDPOINTS
# ================================

@app.api_route("/api/v1/{service_name}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_request(
    service_name: str,
    path: str,
    request: Request,
    user_claims: UserClaims = Depends(verify_jwt_token)
):
    """
    Main proxy endpoint that routes requests to backend services.
    Handles authentication, rate limiting, and request transformation.
    """
    with tracer.start_as_current_span("proxy_request") as span:
        span.set_attribute("service.name", service_name)
        span.set_attribute("service.path", path)
        span.set_attribute("user.id", user_claims.user_id)
        
        # Check rate limiting
        if not await check_rate_limit(request, user_claims):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )
        
        # Read request body
        body = await request.body()
        
        # Route request to backend service
        try:
            status_code, response_headers, response_body = await route_request(
                service_name=service_name,
                path=f"/{path}",
                method=request.method,
                headers=dict(request.headers),
                query_params=dict(request.query_params),
                body=body if body else None
            )
            
            # Prepare response headers (filter out hop-by-hop headers)
            filtered_headers = {
                k: v for k, v in response_headers.items()
                if k.lower() not in [
                    'content-length', 'connection', 'upgrade',
                    'proxy-authenticate', 'proxy-authorization',
                    'te', 'trailers', 'transfer-encoding'
                ]
            }
            
            span.set_attribute("response.status_code", status_code)
            span.set_attribute("response.size", len(response_body))
            
            return Response(
                content=response_body,
                status_code=status_code,
                headers=filtered_headers
            )
            
        except HTTPException:
            raise
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Error proxying request to {service_name}: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Bad Gateway: Unable to reach {service_name}"
            )

# ================================
# AUTHENTICATION ENDPOINTS
# ================================

@app.post("/auth/login")
async def login(request: Request):
    """
    User authentication endpoint.
    Validates credentials and returns JWT token.
    """
    with tracer.start_as_current_span("user_login") as span:
        try:
            body = await request.json()
            username = body.get("username")
            password = body.get("password")
            
            if not username or not password:
                raise HTTPException(
                    status_code=400,
                    detail="Username and password required"
                )
            
            span.set_attribute("auth.username", username)
            
            # TODO: Implement actual user authentication with database
            # For now, using mock authentication
            if username == "admin" and password == "password":
                user_roles = ["admin", "staff"]
            elif username == "user" and password == "password":
                user_roles = ["passenger"]
            else:
                span.set_attribute("auth.result", "failed")
                raise HTTPException(
                    status_code=401,
                    detail="Invalid credentials"
                )
            
            # Generate JWT token
            exp_time = datetime.utcnow() + timedelta(hours=CONFIG["JWT_EXPIRY_HOURS"])
            payload = {
                "user_id": username,
                "email": f"{username}@example.com",
                "roles": user_roles,
                "exp": int(exp_time.timestamp())
            }
            
            token = jwt.encode(
                payload,
                CONFIG["JWT_SECRET"],
                algorithm=CONFIG["JWT_ALGORITHM"]
            )
            
            span.set_attribute("auth.result", "success")
            span.set_attribute("auth.roles", ",".join(user_roles))
            
            return {
                "access_token": token,
                "token_type": "bearer",
                "expires_in": CONFIG["JWT_EXPIRY_HOURS"] * 3600,
                "user": {
                    "id": username,
                    "email": f"{username}@example.com",
                    "roles": user_roles
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Login error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Authentication service error"
            )

@app.post("/auth/logout")
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    User logout endpoint.
    Adds token to blacklist to prevent further use.
    """
    with tracer.start_as_current_span("user_logout") as span:
        try:
            # Add token to blacklist
            token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
            await app_state.redis.setex(
                f"blacklist:{token_hash}",
                CONFIG["JWT_EXPIRY_HOURS"] * 3600,
                "1"
            )
            
            span.set_attribute("auth.token_blacklisted", True)
            
            return {"message": "Successfully logged out"}
            
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Logout error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Logout service error"
            )

# ================================
# ADMIN ENDPOINTS
# ================================

@app.get("/admin/services")
async def list_services(user_claims: UserClaims = Depends(require_roles(["admin"]))):
    """List all registered services with their health status"""
    services_info = {}
    
    for service_name, service_config in app_state.services.items():
        circuit_breaker = app_state.circuit_breakers[service_name]
        services_info[service_name] = {
            "url": service_config.url,
            "health_endpoint": service_config.health_endpoint,
            "circuit_breaker": {
                "state": circuit_breaker.state,
                "failure_count": circuit_breaker.failure_count,
                "last_failure_time": circuit_breaker.last_failure_time
            }
        }
    
    return {"services": services_info}

@app.post("/admin/circuit-breaker/{service_name}/reset")
async def reset_circuit_breaker(
    service_name: str,
    user_claims: UserClaims = Depends(require_roles(["admin"]))
):
    """Manually reset circuit breaker for a service"""
    if service_name not in app_state.circuit_breakers:
        raise HTTPException(
            status_code=404,
            detail=f"Service {service_name} not found"
        )
    
    circuit_breaker = app_state.circuit_breakers[service_name]
    circuit_breaker.state = "CLOSED"
    circuit_breaker.failure_count = 0
    circuit_breaker.last_failure_time = None
    
    logger.info(f"Circuit breaker for {service_name} manually reset by {user_claims.user_id}")
    
    return {"message": f"Circuit breaker for {service_name} has been reset"}

# ================================
# ERROR HANDLERS
# ================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler with detailed error information"""
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    
    error_response = {
        "error": {
            "code": exc.status_code,
            "message": exc.detail,
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path
        }
    }
    
    logger.warning(
        f"HTTP {exc.status_code} error: {exc.detail} "
        f"(correlation_id: {correlation_id}, path: {request.url.path})"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler for unexpected errors"""
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    
    error_response = {
        "error": {
            "code": 500,
            "message": "Internal server error",
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path
        }
    }
    
    logger.error(
        f"Unexpected error: {str(exc)} "
        f"(correlation_id: {correlation_id}, path: {request.url.path})",
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response
    )

# ================================
# APPLICATION ENTRY POINT
# ================================

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=CONFIG["PORT"],
        log_level=CONFIG["LOG_LEVEL"].lower(),
        access_log=True,
        reload=False,  # Set to True for development
        workers=1  # Use multiple workers in production
    ) 
# ================================
# FASTAPI APPLICATION SETUP
# ================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management with comprehensive startup/shutdown procedures.
    
    Startup:
    - Initialize Redis connection pool
    - Setup HTTP session with connection pooling
    - Discover and register services
    - Start health monitoring
    
    Shutdown:
    - Gracefully close connections
    - Stop background tasks
    - Clean up resources
    """
    # ========== STARTUP ==========
    logger.info("ðŸš€ Starting AeroFusionXR API Gateway...")
    
    try:
        # Initialize Redis connection with retry logic
        for attempt in range(3):
            try:
                app_state.redis = redis.from_url(
                    CONFIG["REDIS_URL"],
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    max_connections=20
                )
                await app_state.redis.ping()
                logger.info("âœ“ Redis connection established")
                break
            except redis.RedisError as e:
                if attempt == 2:  # Last attempt
                    logger.error(f"âœ— Failed to connect to Redis after 3 attempts: {e}")
                    raise
                logger.warning(f"Redis connection attempt {attempt + 1} failed: {e}")
                await asyncio.sleep(2)
        
        # Initialize HTTP session with advanced connection pooling
        connector = aiohttp.TCPConnector(
            limit=100,                    # Total connection pool size
            limit_per_host=20,           # Per-host connection limit  
            ttl_dns_cache=300,           # DNS cache TTL in seconds
            use_dns_cache=True,          # Enable DNS caching
            keepalive_timeout=30,        # Keep-alive timeout
            enable_cleanup_closed=True,   # Clean up closed connections
            force_close=False,           # Reuse connections when possible
            ssl=False                    # SSL context (configure for HTTPS)
        )
        
        # Custom timeout configuration for different operation types
        timeout = aiohttp.ClientTimeout(
            total=CONFIG["REQUEST_TIMEOUT"],     # Total request timeout
            connect=10,                          # Connection timeout
            sock_read=CONFIG["REQUEST_TIMEOUT"]  # Socket read timeout
        )
        
        app_state.http_session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': f'AeroFusionXR-Gateway/{CONFIG["VERSION"]}',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
            },
            raise_for_status=False  # Handle status codes manually
        )
        logger.info("âœ“ HTTP session initialized with connection pooling")
        
        # Discover services and initialize monitoring
        await discover_services()
        logger.info("âœ“ Service discovery completed")
        
        # Initialize Prometheus metrics
        for service_name in app_state.services:
            METRICS["service_health"].labels(service=service_name).set(0)
            METRICS["circuit_breaker_state"].labels(service=service_name).set(0)
        
        logger.info("âœ“ Metrics initialized")
        logger.info("ðŸŽ¯ API Gateway startup completed successfully")
        
    except Exception as e:
        logger.error(f"âœ— Failed to start API Gateway: {e}")
        raise
    
    yield
    
    # ========== SHUTDOWN ==========
    logger.info("ðŸ›‘ Shutting down AeroFusionXR API Gateway...")
    
    try:
        # Cancel health monitoring task
        if app_state.health_check_task and not app_state.health_check_task.done():
            app_state.health_check_task.cancel()
            try:
                await app_state.health_check_task
            except asyncio.CancelledError:
                pass
            logger.info("âœ“ Health monitoring stopped")
        
        # Close HTTP session
        if app_state.http_session and not app_state.http_session.closed:
            await app_state.http_session.close()
            logger.info("âœ“ HTTP session closed")
        
        # Close Redis connection
        if app_state.redis:
            await app_state.redis.close()
            logger.info("âœ“ Redis connection closed")
        
        logger.info("âœ“ API Gateway shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Create FastAPI application with comprehensive configuration
app = FastAPI(
    title="AeroFusionXR API Gateway",
    description="""
    Enterprise-grade API Gateway for the AeroFusionXR Aviation Platform.
    
    ## Features
    - ðŸ” JWT Authentication & Role-based Authorization
    - âš¡ Circuit Breaker Pattern for Fault Tolerance
    - ðŸš¦ Redis-backed Rate Limiting
    - ðŸ” Service Discovery & Health Monitoring
    - ðŸ“Š Distributed Tracing & Metrics
    - ðŸ›¡ï¸ Security Headers & CORS Management
    - ðŸ”„ Request/Response Transformation
    - ðŸ“ˆ Real-time Performance Monitoring
    
    ## Authentication
    Use the `/auth/login` endpoint to obtain a JWT token, then include it in the Authorization header:
    `Authorization: Bearer <your-jwt-token>`
    
    ## Rate Limiting
    Rate limits are applied per user/IP and vary by role:
    - Admin: 10,000 requests/hour
    - Staff: 5,000 requests/hour  
    - Premium: 3,000 requests/hour
    - Standard: 1,000 requests/hour
    - Anonymous: 500 requests/hour
    """,
    version=CONFIG["VERSION"],
    contact={
        "name": "AeroFusionXR Team",
        "email": "support@aerofusionxr.com",
        "url": "https://aerofusionxr.com"
    },
    license_info={
        "name": "Proprietary",
        "url": "https://aerofusionxr.com/license"
    },
    docs_url="/docs",
    redoc_url="/redoc", 
    openapi_url="/openapi.json",
    lifespan=lifespan,
    swagger_ui_parameters={
        "deepLinking": True,
        "displayRequestDuration": True,
        "docExpansion": "none",
        "operationsSorter": "method",
        "filter": True,
        "tagsSorter": "alpha"
    }
)

# ================================
# MIDDLEWARE CONFIGURATION
# ================================

# CORS Middleware with security-focused configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",         # Development web client
        "http://localhost:8080",         # Development kiosk
        "https://*.aerofusionxr.com",    # Production domains
        "https://app.aerofusionxr.com",  # Web app
        "https://kiosk.aerofusionxr.com" # Kiosk interface
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type", 
        "Accept",
        "X-Correlation-ID",
        "X-Request-ID",
        "X-User-Agent",
        "User-Agent"
    ],
    expose_headers=[
        "X-Correlation-ID",
        "X-Process-Time",
        "X-Rate-Limit-Remaining",
        "X-Rate-Limit-Reset"
    ],
    max_age=3600  # Cache preflight requests for 1 hour
)

# Trusted Host Middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "api-gateway",
        "*.aerofusionxr.com",
        "api.aerofusionxr.com"
    ]
)

# OpenTelemetry instrumentation
FastAPIInstrumentor.instrument_app(app)
AioHttpClientInstrumentor().instrument()

# ================================
# REQUEST MIDDLEWARE
# ================================

@app.middleware("http")
async def comprehensive_request_middleware(request: Request, call_next):
    """
    Comprehensive request middleware providing:
    - Request correlation tracking
    - Performance timing with detailed metrics
    - Security headers application
    - Request/response logging
    - Error tracking and correlation
    """
    start_time = time.time()
    
    # Generate or extract correlation ID for request tracing
    correlation_id = request.headers.get('x-correlation-id')
    if not correlation_id:
        correlation_id = f"gw-{int(start_time * 1000)}-{os.urandom(4).hex()}"
    
    # Start distributed tracing span
    with tracer.start_as_current_span("http_request") as span:
        # Set comprehensive tracing attributes
        span.set_attribute("http.method", request.method)
        span.set_attribute("http.url", str(request.url))
        span.set_attribute("http.scheme", request.url.scheme)
        span.set_attribute("http.host", request.url.hostname or "unknown")
        span.set_attribute("http.target", request.url.path)
        span.set_attribute("http.user_agent", request.headers.get("user-agent", ""))
        span.set_attribute("http.correlation_id", correlation_id)
        span.set_attribute("client.ip", request.client.host if request.client else "unknown")
        
        # Add correlation ID to request state for downstream access
        request.state.correlation_id = correlation_id
        request.state.start_time = start_time
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Apply comprehensive security headers
            security_headers = {
                # Request tracking headers
                "x-correlation-id": correlation_id,
                "x-process-time": f"{process_time:.4f}",
                
                # Security headers
                "x-content-type-options": "nosniff",
                "x-frame-options": "DENY",
                "x-xss-protection": "1; mode=block",
                "referrer-policy": "strict-origin-when-cross-origin",
                "content-security-policy": "default-src 'self'",
                "strict-transport-security": "max-age=31536000; includeSubDomains",
                
                # API information headers  
                "x-api-version": CONFIG["VERSION"],
                "x-powered-by": "AeroFusionXR-Gateway",
                
                # Cache control for API responses
                "cache-control": "no-cache, no-store, must-revalidate",
                "pragma": "no-cache",
                "expires": "0"
            }
            
            # Apply headers to response
            for header, value in security_headers.items():
                response.headers[header] = value
            
            # Update comprehensive metrics
            METRICS["requests_total"].labels(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                service="api-gateway"
            ).inc()
            
            # Record request duration with detailed labels
            METRICS["request_duration"].labels(
                method=request.method,
                path=request.url.path,
                service="api-gateway"
            ).observe(process_time)
            
            # Update tracing attributes with response information
            span.set_attribute("http.status_code", response.status_code)
            span.set_attribute("http.response_time", process_time)
            
            # Set span status based on response
            if response.status_code >= 400:
                span.set_status(trace.Status(trace.StatusCode.ERROR))
            
            # Log request for audit trail (structured logging)
            log_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "process_time": process_time,
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", ""),
                "response_size": response.headers.get("content-length", "unknown")
            }
            
            if response.status_code >= 400:
                logger.warning(f"Request failed: {json.dumps(log_data)}")
            else:
                logger.info(f"Request completed: {json.dumps(log_data)}")
            
            return response
            
        except Exception as e:
            # Handle request processing errors
            process_time = time.time() - start_time
            
            # Record exception in tracing
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR))
            span.set_attribute("exception.type", type(e).__name__)
            span.set_attribute("exception.message", str(e))
            
            # Update error metrics
            METRICS["requests_total"].labels(
                method=request.method,
                path=request.url.path,
                status_code=500,
                service="api-gateway"
            ).inc()
            
            # Log error with full context
            error_log = {
                "timestamp": datetime.utcnow().isoformat(),
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "process_time": process_time,
                "client_ip": request.client.host if request.client else "unknown"
            }
            logger.error(f"Request error: {json.dumps(error_log)}")
            
            # Re-raise the exception for proper error handling
            raise

# ================================
# CORE API ENDPOINTS
# ================================

@app.get("/health", 
         summary="Service Health Check",
         description="Comprehensive health check for API Gateway and all backend services",
         response_description="Detailed health status information",
         tags=["System"])
async def health_check():
    """
    Comprehensive health check endpoint providing detailed status information.
    
    Returns:
    - Gateway component health (Redis, HTTP session)
    - Individual service health status
    - Circuit breaker states
    - System uptime and version information
    """
    with tracer.start_as_current_span("health_check") as span:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": CONFIG["VERSION"],
            "uptime": str(datetime.utcnow() - app_state.startup_time),
            "environment": os.getenv("ENVIRONMENT", "development"),
            "instance_id": os.getenv("HOSTNAME", "localhost"),
            "components": {},
            "services": {},
            "system": {
                "memory_usage": "N/A",  # Could add psutil for memory monitoring
                "cpu_usage": "N/A",     # Could add psutil for CPU monitoring
                "disk_usage": "N/A"     # Could add psutil for disk monitoring
            }
        }
        
        overall_healthy = True
        
        # Check Redis connection health
        try:
            redis_start = time.time()
            await app_state.redis.ping()
            redis_latency = time.time() - redis_start
            health_status["components"]["redis"] = {
                "status": "healthy",
                "latency_ms": round(redis_latency * 1000, 2),
                "connection_pool": "active"
            }
        except Exception as e:
            health_status["components"]["redis"] = {
                "status": "unhealthy", 
                "error": str(e)
            }
            overall_healthy = False
        
        # Check HTTP session health
        if app_state.http_session and not app_state.http_session.closed:
            connector_info = app_state.http_session.connector
            health_status["components"]["http_session"] = {
                "status": "healthy",
                "connections": {
                    "total": getattr(connector_info, '_connections', {}).get('total', 'unknown'),
                    "available": "unknown"  # aiohttp doesn't expose this easily
                },
                "timeout_config": {
                    "total": CONFIG["REQUEST_TIMEOUT"],
                    "connect": 10
                }
            }
        else:
            health_status["components"]["http_session"] = {
                "status": "unhealthy",
                "error": "HTTP session not initialized or closed"
            }
            overall_healthy = False
        
        # Check backend services health
        for service_name, service_config in app_state.services.items():
            try:
                circuit_breaker = app_state.circuit_breakers[service_name]
                
                # Get current health metric value
                health_metric = METRICS["service_health"].labels(service=service_name)._value._value
                
                service_status = {
                    "status": "healthy" if health_metric == 1 and circuit_breaker.state == "CLOSED" else "unhealthy",
                    "url": service_config.url,
                    "health_endpoint": service_config.health_endpoint,
                    "circuit_breaker": {
                        "state": circuit_breaker.state,
                        "failure_count": circuit_breaker.failure_count,
                        "success_count": circuit_breaker.success_count,
                        "last_failure": circuit_breaker.last_failure_time,
                        "last_success": circuit_breaker.last_success_time
                    },
                    "configuration": {
                        "timeout": service_config.timeout,
                        "max_retries": service_config.max_retries,
                        "weight": service_config.weight
                    }
                }
                
                health_status["services"][service_name] = service_status
                
                # If any critical service is unhealthy, mark overall status as degraded
                if service_status["status"] == "unhealthy":
                    if service_name in ["ai-concierge", "flight-info"]:  # Critical services
                        overall_healthy = False
                    else:
                        # Non-critical services cause degraded status
                        if health_status["status"] == "healthy":
                            health_status["status"] = "degraded"
                    
            except Exception as e:
                health_status["services"][service_name] = {
                    "status": "unknown",
                    "error": str(e)
                }
                overall_healthy = False
        
        # Set overall status
        if not overall_healthy:
            health_status["status"] = "unhealthy"
        
        # Update tracing attributes
        span.set_attribute("health.status", health_status["status"])
        span.set_attribute("health.services_count", len(health_status["services"]))
        span.set_attribute("health.healthy_services", 
                          sum(1 for s in health_status["services"].values() 
                              if s.get("status") == "healthy"))
        
        # Return appropriate HTTP status code
        if health_status["status"] == "healthy":
            status_code = 200
        elif health_status["status"] == "degraded":
            status_code = 200  # Degraded but still operational
        else:
            status_code = 503  # Service unavailable
            
        return JSONResponse(content=health_status, status_code=status_code)

@app.get("/metrics", 
         summary="Prometheus Metrics",
         description="Prometheus-formatted metrics for monitoring and alerting",
         response_class=Response,
         tags=["System"])
async def metrics_endpoint():
    """
    Prometheus metrics endpoint for comprehensive monitoring.
    
    Provides metrics for:
    - Request rates and latencies
    - Service health status
    - Circuit breaker states
    - Rate limiting violations
    - JWT validation statistics
    """
    return Response(
        content=generate_latest(), 
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )

@app.get("/info",
         summary="Service Information", 
         description="Detailed service information and capabilities",
         tags=["System"])
async def service_info():
    """
    Service information endpoint providing:
    - Version and build information
    - Feature capabilities
    - Environment configuration  
    - Service registry
    """
    return {
        "service": {
            "name": CONFIG["SERVICE_NAME"],
            "version": CONFIG["VERSION"],
            "description": "Enterprise API Gateway for AeroFusionXR Aviation Platform",
            "build_info": {
                "build_time": os.getenv("BUILD_TIME", "unknown"),
                "git_commit": os.getenv("GIT_COMMIT", "unknown"),
                "git_branch": os.getenv("GIT_BRANCH", "unknown")
            }
        },
        "environment": {
            "name": os.getenv("ENVIRONMENT", "development"),
            "instance_id": os.getenv("HOSTNAME", "localhost"),
            "region": os.getenv("AWS_REGION", "unknown"),
            "availability_zone": os.getenv("AWS_AZ", "unknown")
        },
        "capabilities": {
            "authentication": {
                "jwt_enabled": True,
                "supported_algorithms": [CONFIG["JWT_ALGORITHM"]],
                "token_expiry_hours": CONFIG["JWT_EXPIRY_HOURS"]
            },
            "rate_limiting": {
                "enabled": True,
                "backend": "redis",
                "algorithm": "sliding_window",
                "base_limit": CONFIG["RATE_LIMIT_REQUESTS"]
            },
            "circuit_breaker": {
                "enabled": True,
                "failure_threshold": CONFIG["CIRCUIT_BREAKER_FAILURES"],
                "timeout_seconds": CONFIG["CIRCUIT_BREAKER_TIMEOUT"]
            },
            "monitoring": {
                "tracing": "opentelemetry",
                "metrics": "prometheus",
                "logging": "structured_json"
            }
        },
        "services": {
            "registered": list(app_state.services.keys()),
            "total_count": len(app_state.services),
            "discovery_method": "static_configuration"  # TODO: Update when dynamic
        },
        "uptime": str(datetime.utcnow() - app_state.startup_time),
        "requests_served": int(METRICS["requests_total"]._value.sum())
    }

# Continue in next part... 
# ================================
# AUTHENTICATION ENDPOINTS
# ================================

class LoginRequest(BaseModel):
    """Login request model with validation"""
    username: str = Field(..., min_length=3, max_length=50, description="Username for authentication")
    password: str = Field(..., min_length=6, description="User password")
    remember_me: bool = Field(default=False, description="Extend token validity")
    
class LoginResponse(BaseModel):
    """Login response model"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

@app.post("/auth/login",
          summary="User Authentication",
          description="Authenticate user and return JWT token with role-based permissions",
          response_model=LoginResponse,
          tags=["Authentication"])
async def login(request: LoginRequest):
    """
    Authenticate user credentials and return JWT access token.
    
    Supports aviation industry roles:
    - admin: Full system administration
    - staff: Airport/airline staff operations
    - premium: Premium passenger features
    - passenger: Standard passenger features
    
    Returns JWT token valid for configured hours with user profile information.
    """
    with tracer.start_as_current_span("user_authentication") as span:
        span.set_attribute("auth.username", request.username)
        span.set_attribute("auth.remember_me", request.remember_me)
        
        try:
            # TODO: Replace with actual user authentication service
            # This is a mock implementation for demonstration
            authenticated_user = await authenticate_user(request.username, request.password)
            
            if not authenticated_user:
                span.set_attribute("auth.result", "failed")
                span.set_attribute("auth.failure_reason", "invalid_credentials")
                METRICS["jwt_validations"].labels(status="auth_failed").inc()
                raise HTTPException(
                    status_code=401,
                    detail="Invalid username or password",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            # Determine token expiry based on remember_me flag
            expiry_hours = CONFIG["JWT_EXPIRY_HOURS"] * (7 if request.remember_me else 1)
            exp_time = datetime.utcnow() + timedelta(hours=expiry_hours)
            
            # Create comprehensive JWT payload
            payload = {
                "user_id": authenticated_user["id"],
                "email": authenticated_user["email"],
                "roles": authenticated_user["roles"],
                "passenger_id": authenticated_user.get("passenger_id"),
                "airline_code": authenticated_user.get("airline_code"),
                "flight_number": authenticated_user.get("flight_number"),
                "frequent_flyer_tier": authenticated_user.get("frequent_flyer_tier"),
                "exp": int(exp_time.timestamp()),
                "iat": int(datetime.utcnow().timestamp()),
                "iss": "aerofusionxr-gateway",
                "aud": "aerofusionxr-platform"
            }
            
            # Generate JWT token
            token = jwt.encode(
                payload,
                CONFIG["JWT_SECRET"],
                algorithm=CONFIG["JWT_ALGORITHM"]
            )
            
            # Update metrics and tracing
            span.set_attribute("auth.result", "success")
            span.set_attribute("auth.user_id", authenticated_user["id"])
            span.set_attribute("auth.roles", ",".join(authenticated_user["roles"]))
            span.set_attribute("auth.token_expiry", exp_time.isoformat())
            
            METRICS["jwt_validations"].labels(status="issued").inc()
            
            logger.info(f"User {request.username} authenticated successfully")
            
            return LoginResponse(
                access_token=token,
                expires_in=expiry_hours * 3600,
                user={
                    "id": authenticated_user["id"],
                    "email": authenticated_user["email"],
                    "username": request.username,
                    "roles": authenticated_user["roles"],
                    "profile": {
                        "passenger_id": authenticated_user.get("passenger_id"),
                        "airline_code": authenticated_user.get("airline_code"),
                        "frequent_flyer_tier": authenticated_user.get("frequent_flyer_tier")
                    }
                }
            )
            
        except HTTPException:
            raise
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Authentication service error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Authentication service temporarily unavailable"
            )

async def authenticate_user(username: str, password: str) -> Optional[dict]:
    """
    Mock user authentication function.
    TODO: Replace with actual user service integration.
    """
    # Mock user database with aviation industry personas
    mock_users = {
        "admin": {
            "id": "admin_001",
            "email": "admin@aerofusionxr.com",
            "password": "admin123",  # In production: use proper password hashing
            "roles": ["admin", "staff"],
            "airline_code": "AXR"
        },
        "pilot": {
            "id": "pilot_001", 
            "email": "pilot@airline.com",
            "password": "pilot123",
            "roles": ["staff", "pilot"],
            "airline_code": "UAL",
            "employee_id": "P12345"
        },
        "staff": {
            "id": "staff_001",
            "email": "staff@airport.com", 
            "password": "staff123",
            "roles": ["staff"],
            "airline_code": "DFW",
            "department": "operations"
        },
        "premium": {
            "id": "pax_premium_001",
            "email": "premium@example.com",
            "password": "premium123", 
            "roles": ["premium", "passenger"],
            "passenger_id": "FFP789012",
            "frequent_flyer_tier": "platinum"
        },
        "passenger": {
            "id": "pax_001",
            "email": "passenger@example.com",
            "password": "passenger123",
            "roles": ["passenger"],
            "passenger_id": "PAX123456"
        }
    }
    
    user = mock_users.get(username)
    if user and user["password"] == password:
        return user
    return None

@app.post("/auth/logout",
          summary="User Logout", 
          description="Logout user and invalidate JWT token",
          tags=["Authentication"])
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Logout user by adding their JWT token to a blacklist.
    The token will be invalid for all future requests until expiry.
    """
    with tracer.start_as_current_span("user_logout") as span:
        try:
            # Extract user information from token for logging
            try:
                payload = jwt.decode(
                    credentials.credentials,
                    CONFIG["JWT_SECRET"], 
                    algorithms=[CONFIG["JWT_ALGORITHM"]],
                    options={"verify_exp": False}  # Allow expired tokens for logout
                )
                user_id = payload.get("user_id", "unknown")
                span.set_attribute("auth.user_id", user_id)
            except jwt.InvalidTokenError:
                user_id = "unknown"
            
            # Add token to blacklist with TTL matching original expiry
            token_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
            
            # Calculate remaining TTL (token might be partially expired)
            try:
                remaining_ttl = max(300, payload.get("exp", 0) - int(time.time()))  # Min 5 minutes
            except:
                remaining_ttl = CONFIG["JWT_EXPIRY_HOURS"] * 3600
            
            await app_state.redis.setex(
                f"token_blacklist:{token_hash}",
                remaining_ttl,
                json.dumps({
                    "user_id": user_id,
                    "blacklisted_at": datetime.utcnow().isoformat(),
                    "reason": "user_logout"
                })
            )
            
            span.set_attribute("auth.token_blacklisted", True)
            span.set_attribute("auth.blacklist_ttl", remaining_ttl)
            
            logger.info(f"User {user_id} logged out successfully")
            
            return {
                "message": "Successfully logged out",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Logout error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Logout service error"
            )

@app.post("/auth/refresh",
          summary="Refresh JWT Token",
          description="Refresh JWT token for extended session",
          tags=["Authentication"])
async def refresh_token(
    user_claims: UserClaims = Depends(verify_jwt_token)
):
    """
    Refresh JWT token for authenticated user.
    Issues a new token with updated expiration time.
    """
    with tracer.start_as_current_span("token_refresh") as span:
        try:
            # Generate new token with fresh expiry
            exp_time = datetime.utcnow() + timedelta(hours=CONFIG["JWT_EXPIRY_HOURS"])
            
            payload = {
                "user_id": user_claims.user_id,
                "email": user_claims.email,
                "roles": user_claims.roles,
                "passenger_id": user_claims.passenger_id,
                "airline_code": user_claims.airline_code,
                "flight_number": user_claims.flight_number,
                "frequent_flyer_tier": user_claims.frequent_flyer_tier,
                "exp": int(exp_time.timestamp()),
                "iat": int(datetime.utcnow().timestamp()),
                "iss": "aerofusionxr-gateway",
                "aud": "aerofusionxr-platform"
            }
            
            new_token = jwt.encode(
                payload,
                CONFIG["JWT_SECRET"],
                algorithm=CONFIG["JWT_ALGORITHM"]
            )
            
            span.set_attribute("auth.user_id", user_claims.user_id)
            span.set_attribute("auth.new_expiry", exp_time.isoformat())
            
            METRICS["jwt_validations"].labels(status="refreshed").inc()
            
            return {
                "access_token": new_token,
                "token_type": "bearer",
                "expires_in": CONFIG["JWT_EXPIRY_HOURS"] * 3600,
                "expires_at": exp_time.isoformat()
            }
            
        except Exception as e:
            span.record_exception(e)
            raise HTTPException(
                status_code=500,
                detail="Token refresh failed"
            )

# ================================
# DYNAMIC PROXY ENDPOINTS  
# ================================

@app.api_route("/api/v1/{service_name}/{path:path}", 
               methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
               summary="Service Proxy",
               description="Dynamic proxy endpoint for all backend services with authentication and rate limiting",
               tags=["Proxy"])
async def proxy_service_request(
    service_name: str,
    path: str, 
    request: Request,
    user_claims: UserClaims = Depends(verify_jwt_token)
):
    """
    Main proxy endpoint routing requests to backend microservices.
    
    Features:
    - JWT authentication and role validation
    - Per-user/role rate limiting
    - Circuit breaker protection
    - Request/response transformation
    - Comprehensive tracing and metrics
    - Error handling and retries
    
    Path format: /api/v1/{service_name}/{service_path}
    """
    with tracer.start_as_current_span("service_proxy") as span:
        span.set_attribute("proxy.service_name", service_name)
        span.set_attribute("proxy.service_path", path)
        span.set_attribute("proxy.user_id", user_claims.user_id)
        span.set_attribute("proxy.user_roles", ",".join(user_claims.roles))
        
        # Validate service exists
        if service_name not in app_state.services:
            span.set_attribute("proxy.error", "service_not_found")
            raise HTTPException(
                status_code=404,
                detail=f"Service '{service_name}' not found in registry. Available services: {list(app_state.services.keys())}"
            )
        
        # Apply rate limiting
        if not await check_rate_limit(request, user_claims):
            span.set_attribute("proxy.rate_limited", True)
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": "60",
                    "X-Rate-Limit-Service": service_name
                }
            )
        
        # TODO: Add service-specific role validation
        # For example, booking service might require 'passenger' role
        service_role_requirements = {
            "ai-concierge": [],  # Available to all authenticated users
            "flight-info": [],   # Public flight information
            "wayfinding": [],    # Navigation available to all
            "baggage-tracker": ["passenger", "staff"],  # Passenger or staff only
            "commerce": ["passenger", "premium"],       # Shopping for passengers
            "booking": ["passenger", "premium", "staff"] # Booking operations
        }
        
        required_roles = service_role_requirements.get(service_name, [])
        if required_roles:
            user_roles_set = set(user_claims.roles)
            if not ("admin" in user_roles_set or user_roles_set.intersection(required_roles)):
                span.set_attribute("proxy.insufficient_permissions", True)
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient permissions for {service_name}. Required roles: {required_roles}"
                )
        
        try:
            # Read request body
            body = await request.body()
            
            # Add user context to headers for backend services
            enhanced_headers = dict(request.headers)
            enhanced_headers.update({
                "x-user-id": user_claims.user_id,
                "x-user-email": user_claims.email,
                "x-user-roles": ",".join(user_claims.roles),
                "x-passenger-id": user_claims.passenger_id or "",
                "x-airline-code": user_claims.airline_code or "",
                "x-frequent-flyer-tier": user_claims.frequent_flyer_tier or ""
            })
            
            # Route request to backend service
            status_code, response_headers, response_body = await route_request(
                service_name=service_name,
                path=f"/{path}",
                method=request.method,
                headers=enhanced_headers,
                query_params=dict(request.query_params),
                body=body if body else None
            )
            
            # Filter response headers
            filtered_response_headers = {
                k: v for k, v in response_headers.items()
                if k.lower() not in [
                    'content-length', 'connection', 'transfer-encoding',
                    'content-encoding'  # Let FastAPI handle encoding
                ]
            }
            
            # Update metrics
            METRICS["requests_total"].labels(
                method=request.method,
                path=f"/api/v1/{service_name}/*",
                status_code=status_code,
                service=service_name
            ).inc()
            
            # Update tracing
            span.set_attribute("proxy.backend_status", status_code)
            span.set_attribute("proxy.response_size", len(response_body))
            span.set_attribute("proxy.success", status_code < 400)
            
            return Response(
                content=response_body,
                status_code=status_code,
                headers=filtered_response_headers,
                media_type=response_headers.get("content-type", "application/json")
            )
            
        except HTTPException:
            raise
        except Exception as e:
            span.record_exception(e)
            logger.error(
                f"Proxy error for {service_name}: {e}",
                extra={
                    "service_name": service_name,
                    "path": path,
                    "user_id": user_claims.user_id,
                    "correlation_id": getattr(request.state, 'correlation_id', 'unknown')
                }
            )
            raise HTTPException(
                status_code=502,
                detail=f"Bad Gateway: Unable to process request to {service_name}"
            )

# ================================
# ADMIN ENDPOINTS
# ================================

@app.get("/admin/services",
         summary="List Registered Services",
         description="Get detailed information about all registered backend services",
         dependencies=[Depends(require_roles(["admin"]))],
         tags=["Admin"])
async def list_services():
    """
    Administrative endpoint to view all registered services.
    Provides detailed status, configuration, and circuit breaker information.
    """
    services_info = {}
    
    for service_name, service_config in app_state.services.items():
        circuit_breaker = app_state.circuit_breakers[service_name]
        
        # Get service health metric
        try:
            health_value = METRICS["service_health"].labels(service=service_name)._value._value
        except:
            health_value = 0
            
        services_info[service_name] = {
            "configuration": {
                "url": service_config.url,
                "health_endpoint": service_config.health_endpoint,
                "timeout": service_config.timeout,
                "max_retries": service_config.max_retries,
                "weight": service_config.weight
            },
            "health": {
                "status": "healthy" if health_value == 1 else "unhealthy",
                "last_check": "unknown"  # Would need to track this
            },
            "circuit_breaker": {
                "state": circuit_breaker.state,
                "failure_count": circuit_breaker.failure_count,
                "success_count": circuit_breaker.success_count,
                "failure_threshold": circuit_breaker.failure_threshold,
                "timeout": circuit_breaker.timeout,
                "last_failure_time": circuit_breaker.last_failure_time,
                "last_success_time": circuit_breaker.last_success_time
            }
        }
    
    return {
        "services": services_info,
        "summary": {
            "total_services": len(services_info),
            "healthy_services": sum(1 for s in services_info.values() 
                                  if s["health"]["status"] == "healthy"),
            "services_with_open_breakers": sum(1 for s in services_info.values()
                                             if s["circuit_breaker"]["state"] == "OPEN")
        }
    }

@app.post("/admin/circuit-breaker/{service_name}/reset",
          summary="Reset Circuit Breaker",
          description="Manually reset circuit breaker for a specific service",
          dependencies=[Depends(require_roles(["admin"]))],
          tags=["Admin"])
async def reset_circuit_breaker(service_name: str, user_claims: UserClaims = Depends(verify_jwt_token)):
    """
    Manually reset circuit breaker for a service.
    This forces the circuit breaker back to CLOSED state.
    """
    if service_name not in app_state.circuit_breakers:
        raise HTTPException(
            status_code=404,
            detail=f"Service '{service_name}' not found in circuit breaker registry"
        )
    
    circuit_breaker = app_state.circuit_breakers[service_name]
    old_state = circuit_breaker.state
    
    # Reset circuit breaker state
    await circuit_breaker._reset_breaker()
    
    # Log administrative action
    logger.warning(
        f"Circuit breaker for {service_name} manually reset by admin {user_claims.user_id}",
        extra={
            "admin_user": user_claims.user_id,
            "service_name": service_name,
            "previous_state": old_state,
            "action": "manual_reset"
        }
    )
    
    return {
        "message": f"Circuit breaker for '{service_name}' has been reset",
        "previous_state": old_state,
        "current_state": circuit_breaker.state,
        "reset_by": user_claims.user_id,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/admin/metrics/summary",
         summary="Metrics Summary",
         description="Get aggregated metrics summary for monitoring dashboard",
         dependencies=[Depends(require_roles(["admin", "staff"]))],
         tags=["Admin"])
async def metrics_summary():
    """
    Provide aggregated metrics summary for administrative dashboards.
    """
    try:
        # Calculate request statistics
        total_requests = int(METRICS["requests_total"]._value.sum()) if hasattr(METRICS["requests_total"]._value, 'sum') else 0
        
        # Get service health overview
        service_health_overview = {}
        for service_name in app_state.services:
            try:
                health_value = METRICS["service_health"].labels(service=service_name)._value._value
                service_health_overview[service_name] = health_value == 1
            except:
                service_health_overview[service_name] = False
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": str(datetime.utcnow() - app_state.startup_time),
            "requests": {
                "total_served": total_requests,
                "current_rate": "N/A"  # Would need time-windowed calculation
            },
            "services": {
                "total_registered": len(app_state.services),
                "healthy_count": sum(service_health_overview.values()),
                "unhealthy_count": len(service_health_overview) - sum(service_health_overview.values()),
                "health_overview": service_health_overview
            },
            "circuit_breakers": {
                service: {
                    "state": app_state.circuit_breakers[service].state,
                    "failure_count": app_state.circuit_breakers[service].failure_count
                }
                for service in app_state.services
            },
            "system": {
                "redis_connected": True,  # Simplified check
                "http_session_active": not (app_state.http_session and app_state.http_session.closed)
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating metrics summary: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate metrics summary"
        )

# ================================
# ERROR HANDLERS
# ================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Comprehensive HTTP exception handler with detailed error information.
    Provides consistent error format across all endpoints.
    """
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    
    error_response = {
        "error": {
            "code": exc.status_code,
            "message": exc.detail,
            "type": "http_exception",
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method
        },
        "request_id": correlation_id
    }
    
    # Add additional context for certain error types
    if exc.status_code == 401:
        error_response["error"]["auth_required"] = True
        error_response["error"]["login_url"] = "/auth/login"
    elif exc.status_code == 403:
        error_response["error"]["insufficient_permissions"] = True
    elif exc.status_code == 429:
        error_response["error"]["rate_limited"] = True
        error_response["error"]["retry_after"] = exc.headers.get("Retry-After", "60")
    
    # Log errors appropriately
    if exc.status_code >= 500:
        logger.error(f"Server error {exc.status_code}: {exc.detail} (correlation_id: {correlation_id})")
    elif exc.status_code >= 400:
        logger.warning(f"Client error {exc.status_code}: {exc.detail} (correlation_id: {correlation_id})")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers=exc.headers
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    General exception handler for unexpected errors.
    Ensures no sensitive information leaks in error responses.
    """
    correlation_id = getattr(request.state, 'correlation_id', 'unknown')
    
    error_response = {
        "error": {
            "code": 500,
            "message": "Internal server error",
            "type": "unexpected_error",
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method
        },
        "request_id": correlation_id,
        "support": {
            "message": "Please contact support with the correlation_id for assistance",
            "email": "support@aerofusionxr.com"
        }
    }
    
    # Log full error details for internal debugging
    logger.error(
        f"Unexpected error: {str(exc)}",
        exc_info=True,
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else "unknown"
        }
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response
    )

# ================================
# APPLICATION ENTRY POINT
# ================================

if __name__ == "__main__":
    import uvicorn
    
    # Configure uvicorn for production deployment
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=CONFIG["PORT"],
        log_level=CONFIG["LOG_LEVEL"].lower(),
        access_log=True,
        server_header=False,  # Don't expose server information
        date_header=False,    # Don't expose server date
        reload=False,         # Disable reload in production
        workers=1,           # Single worker for now, scale horizontally with k8s
        timeout_keep_alive=30,
        timeout_graceful_shutdown=30
    ) 
