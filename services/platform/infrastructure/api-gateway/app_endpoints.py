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
    logger.info("🚀 Starting AeroFusionXR API Gateway...")
    
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
                logger.info("✓ Redis connection established")
                break
            except redis.RedisError as e:
                if attempt == 2:  # Last attempt
                    logger.error(f"✗ Failed to connect to Redis after 3 attempts: {e}")
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
        logger.info("✓ HTTP session initialized with connection pooling")
        
        # Discover services and initialize monitoring
        await discover_services()
        logger.info("✓ Service discovery completed")
        
        # Initialize Prometheus metrics
        for service_name in app_state.services:
            METRICS["service_health"].labels(service=service_name).set(0)
            METRICS["circuit_breaker_state"].labels(service=service_name).set(0)
        
        logger.info("✓ Metrics initialized")
        logger.info("🎯 API Gateway startup completed successfully")
        
    except Exception as e:
        logger.error(f"✗ Failed to start API Gateway: {e}")
        raise
    
    yield
    
    # ========== SHUTDOWN ==========
    logger.info("🛑 Shutting down AeroFusionXR API Gateway...")
    
    try:
        # Cancel health monitoring task
        if app_state.health_check_task and not app_state.health_check_task.done():
            app_state.health_check_task.cancel()
            try:
                await app_state.health_check_task
            except asyncio.CancelledError:
                pass
            logger.info("✓ Health monitoring stopped")
        
        # Close HTTP session
        if app_state.http_session and not app_state.http_session.closed:
            await app_state.http_session.close()
            logger.info("✓ HTTP session closed")
        
        # Close Redis connection
        if app_state.redis:
            await app_state.redis.close()
            logger.info("✓ Redis connection closed")
        
        logger.info("✓ API Gateway shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Create FastAPI application with comprehensive configuration
app = FastAPI(
    title="AeroFusionXR API Gateway",
    description="""
    Enterprise-grade API Gateway for the AeroFusionXR Aviation Platform.
    
    ## Features
    - 🔐 JWT Authentication & Role-based Authorization
    - ⚡ Circuit Breaker Pattern for Fault Tolerance
    - 🚦 Redis-backed Rate Limiting
    - 🔍 Service Discovery & Health Monitoring
    - 📊 Distributed Tracing & Metrics
    - 🛡️ Security Headers & CORS Management
    - 🔄 Request/Response Transformation
    - 📈 Real-time Performance Monitoring
    
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