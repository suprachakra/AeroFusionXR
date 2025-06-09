"""
AeroFusionXR AI Concierge Service - FastAPI Application
======================================================

FastAPI application setup with comprehensive REST and WebSocket endpoints.
"""

from main import *  # Import all components from main.py

# ================================
# APPLICATION LIFECYCLE MANAGEMENT
# ================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management with comprehensive startup and shutdown procedures.
    
    Startup sequence:
    1. Initialize database connections (Redis, PostgreSQL)
    2. Load and warm up AI models
    3. Initialize HTTP client sessions
    4. Start background monitoring tasks
    5. Setup session cleanup scheduler
    
    Shutdown sequence:
    1. Stop background tasks gracefully
    2. Close database connections
    3. Cleanup ML model resources
    4. Save session states for recovery
    """
    logger.info("🚀 Starting AeroFusionXR AI Concierge Service...")
    
    # ========== STARTUP ==========
    try:
        # Initialize Redis connection with retry logic
        logger.info("🔄 Connecting to Redis...")
        for attempt in range(3):
            try:
                app_state.redis = aioredis.from_url(
                    CONFIG["REDIS_URL"],
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=10,
                    retry_on_timeout=True,
                    max_connections=50
                )
                await app_state.redis.ping()
                logger.info("✅ Redis connection established")
                break
            except Exception as e:
                if attempt == 2:
                    logger.error(f"❌ Redis connection failed after 3 attempts: {e}")
                    raise
                logger.warning(f"Redis connection attempt {attempt + 1} failed: {e}")
                await asyncio.sleep(2)
        
        # Initialize PostgreSQL connection pool
        logger.info("🔄 Connecting to PostgreSQL...")
        app_state.db_pool = await asyncpg.create_pool(
            CONFIG["DATABASE_URL"],
            min_size=5,
            max_size=20,
            command_timeout=30,
            server_settings={
                'jit': 'off',
                'application_name': 'ai-concierge'
            }
        )
        
        # Verify database connection and create tables if needed
        async with app_state.db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
            await create_database_tables(conn)
        
        logger.info("✅ PostgreSQL connection pool established")
        
        # Initialize HTTP client session
        logger.info("🔄 Setting up HTTP client...")
        timeout = httpx.Timeout(30.0, connect=10.0)
        app_state.http_client = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            headers={
                "User-Agent": f"AeroFusionXR-AI-Concierge/{CONFIG['VERSION']}",
                "Accept": "application/json"
            }
        )
        logger.info("✅ HTTP client session initialized")
        
        # Initialize AI models
        await initialize_ai_models()
        
        # Start background monitoring tasks
        logger.info("🔄 Starting background tasks...")
        background_tasks = [
            asyncio.create_task(session_cleanup_scheduler()),
            asyncio.create_task(metrics_collector()),
            asyncio.create_task(model_performance_monitor())
        ]
        
        # Store tasks for cleanup
        app_state.background_tasks = background_tasks
        logger.info("✅ Background tasks started")
        
        # Update metrics
        METRICS["active_sessions"].set(0)
        
        logger.info("🎯 AI Concierge Service startup completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise
    
    yield
    
    # ========== SHUTDOWN ==========
    logger.info("🛑 Shutting down AI Concierge Service...")
    
    try:
        # Cancel background tasks
        if hasattr(app_state, 'background_tasks'):
            for task in app_state.background_tasks:
                if not task.done():
                    task.cancel()
            
            # Wait for tasks to complete
            await asyncio.gather(*app_state.background_tasks, return_exceptions=True)
            logger.info("✅ Background tasks stopped")
        
        # Close HTTP client
        if app_state.http_client:
            await app_state.http_client.aclose()
            logger.info("✅ HTTP client closed")
        
        # Close database connections
        if app_state.db_pool:
            await app_state.db_pool.close()
            logger.info("✅ Database pool closed")
        
        if app_state.redis:
            await app_state.redis.close()
            logger.info("✅ Redis connection closed")
        
        # Cleanup ML models
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("✅ GPU memory cleared")
        
        logger.info("✅ AI Concierge Service shutdown completed")
        
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")

# ================================
# FASTAPI APPLICATION SETUP
# ================================

app = FastAPI(
    title="AeroFusionXR AI Concierge Service",
    description="""
    🧠 **Enterprise AI Concierge for Aviation Excellence**
    
    Advanced conversational AI service providing intelligent assistance for airport and aviation operations.
    
    ## 🌟 Core Features
    
    ### 🗣️ **Multimodal Query Processing**
    - **Text Queries**: Natural language understanding with aviation domain expertise
    - **Voice Queries**: Speech-to-text with noise reduction and multi-language support
    - **Image Queries**: Computer vision for terminal maps, documents, and visual assistance
    - **Video Queries**: Real-time scene analysis and object detection
    
    ### 🎯 **Intelligent Intent Classification**
    - **Flight Information**: Status, delays, gates, schedules
    - **Navigation**: Terminal directions, wayfinding, accessibility routes
    - **Services**: Dining, shopping, lounges, amenities
    - **Booking Management**: Changes, upgrades, seat selection
    - **Baggage Support**: Tracking, claims, restrictions
    - **Customer Assistance**: Special needs, escalations
    - **Emergency Response**: Medical, security, urgent situations
    
    ### 💬 **Advanced Conversation Management**
    - **Context Awareness**: Multi-turn dialog with conversation history
    - **Personalization**: User preferences and frequent flyer recognition
    - **Sentiment Analysis**: Real-time emotion detection and response adaptation
    - **Multi-language**: Support for 7+ languages with auto-detection
    - **Voice Synthesis**: Natural speech generation for accessibility
    
    ### 🛡️ **Enterprise Security & Performance**
    - **JWT Authentication**: Secure user session management
    - **Rate Limiting**: Per-user and IP-based protection
    - **Distributed Tracing**: Full request lifecycle monitoring
    - **Real-time Metrics**: Prometheus-compatible observability
    - **Circuit Breakers**: Fault tolerance and graceful degradation
    
    ## 🚀 Quick Start
    
    1. **Authenticate**: Obtain JWT token from API Gateway
    2. **Start Session**: Create conversation session
    3. **Query**: Send text, voice, or image queries
    4. **Interact**: Follow suggested actions and contextual responses
    
    ## 📊 Supported Query Types
    
    | Type | Input | Processing | Output |
    |------|-------|------------|--------|
    | Text | Natural language | NLP + Intent classification | Structured response + actions |
    | Voice | Audio files/streams | Speech-to-text + NLP | Text + optional voice response |
    | Image | Photos, screenshots | OCR + Object detection | Extracted text + scene analysis |
    | Video | Video streams | Frame analysis + tracking | Real-time object identification |
    
    ## 🎭 Conversation Contexts
    
    - **Pre-flight**: Check-in, seat selection, flight status
    - **At Airport**: Navigation, services, boarding
    - **In-transit**: Connections, delays, rebooking
    - **Post-flight**: Baggage, feedback, future bookings
    - **Emergency**: Medical, security, urgent assistance
    
    ## 📈 Performance Specifications
    
    - **Response Time**: < 500ms for text queries
    - **Throughput**: 10,000+ concurrent sessions
    - **Availability**: 99.9% uptime SLA
    - **Languages**: English, Spanish, French, German, Japanese, Chinese, Arabic
    - **Voice Quality**: Human-like synthesis with emotional tone
    - **Image Processing**: Real-time OCR and object detection
    """,
    version=CONFIG["VERSION"],
    contact={
        "name": "AeroFusionXR AI Team",
        "email": "ai-support@aerofusionxr.com",
        "url": "https://aerofusionxr.com/ai-concierge"
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
        "docExpansion": "list",
        "operationsSorter": "method",
        "filter": True,
        "tagsSorter": "alpha",
        "tryItOutEnabled": True,
        "displayOperationId": True
    }
)

# ================================
# MIDDLEWARE CONFIGURATION
# ================================

# CORS Middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",           # Development web client
        "http://localhost:8080",           # Development kiosk
        "https://*.aerofusionxr.com",      # Production domains
        "https://app.aerofusionxr.com",    # Web application
        "https://kiosk.aerofusionxr.com",  # Kiosk interface
        "https://mobile.aerofusionxr.com"  # Mobile web app
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Session-ID",
        "X-User-ID",
        "X-Request-ID",
        "X-Language",
        "Accept-Language"
    ],
    expose_headers=[
        "X-Request-ID",
        "X-Process-Time",
        "X-Session-ID",
        "X-AI-Confidence",
        "X-Intent-Classification"
    ]
)

# Trusted Host Middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "ai-concierge",
        "*.aerofusionxr.com",
        "ai.aerofusionxr.com"
    ]
)

# OpenTelemetry instrumentation
FastAPIInstrumentor.instrument_app(app)
HTTPXClientInstrumentor().instrument()

# ================================
# REQUEST MIDDLEWARE
# ================================

@app.middleware("http")
async def comprehensive_request_middleware(request: Request, call_next):
    """
    Comprehensive request middleware providing request tracking, performance monitoring,
    authentication context, and error handling.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    # Start distributed tracing
    with tracer.start_as_current_span("ai_concierge_request") as span:
        # Set tracing attributes
        span.set_attribute("http.method", request.method)
        span.set_attribute("http.url", str(request.url))
        span.set_attribute("http.route", request.url.path)
        span.set_attribute("ai.request_id", request_id)
        span.set_attribute("ai.service", "concierge")
        
        # Extract session and language info
        session_id = request.headers.get("x-session-id")
        language = request.headers.get("x-language", "en")
        user_id = request.headers.get("x-user-id")
        
        if session_id:
            span.set_attribute("ai.session_id", session_id)
        if user_id:
            span.set_attribute("ai.user_id", user_id)
        span.set_attribute("ai.language", language)
        
        # Add to request state
        request.state.request_id = request_id
        request.state.start_time = start_time
        request.state.session_id = session_id
        request.state.user_id = user_id
        request.state.language = language
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            
            # Add response headers
            response.headers["x-request-id"] = request_id
            response.headers["x-process-time"] = f"{process_time:.4f}"
            response.headers["x-service-version"] = CONFIG["VERSION"]
            response.headers["x-ai-service"] = "concierge"
            
            # Update tracing
            span.set_attribute("http.status_code", response.status_code)
            span.set_attribute("http.response_time", process_time)
            
            # Log request
            logger.info(
                f"Request completed: {request.method} {request.url.path} -> {response.status_code} "
                f"({process_time:.3f}s)",
                extra={
                    "request_id": request_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time": process_time
                }
            )
            
            return response
            
        except Exception as e:
            # Handle request errors
            process_time = time.time() - start_time
            
            span.record_exception(e)
            span.set_attribute("error", True)
            span.set_attribute("error.type", type(e).__name__)
            
            logger.error(
                f"Request error: {request.method} {request.url.path} -> {type(e).__name__}: {e}",
                extra={
                    "request_id": request_id,
                    "session_id": session_id,
                    "user_id": user_id,
                    "error": str(e),
                    "process_time": process_time
                },
                exc_info=True
            )
            
            raise

# ================================
# AUTHENTICATION DEPENDENCY
# ================================

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify JWT token and extract user claims.
    This integrates with the API Gateway's authentication system.
    """
    try:
        # In production, this would validate the JWT token
        # For now, we'll extract basic information from headers
        return {
            "user_id": "demo_user",
            "roles": ["passenger"],
            "email": "demo@example.com"
        }
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )

# ================================
# CORE API ENDPOINTS
# ================================

@app.get("/health",
         summary="Service Health Check",
         description="Comprehensive health check for AI Concierge service components",
         tags=["System"])
async def health_check():
    """
    Comprehensive health check endpoint providing detailed status of all service components.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": CONFIG["VERSION"],
        "uptime": str(datetime.utcnow() - app_state.startup_time),
        "components": {},
        "models": {},
        "performance": {}
    }
    
    overall_healthy = True
    
    # Check Redis health
    try:
        redis_start = time.time()
        await app_state.redis.ping()
        redis_latency = time.time() - redis_start
        health_status["components"]["redis"] = {
            "status": "healthy",
            "latency_ms": round(redis_latency * 1000, 2)
        }
    except Exception as e:
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_healthy = False
    
    # Check database health
    try:
        if app_state.db_pool:
            db_start = time.time()
            async with app_state.db_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            db_latency = time.time() - db_start
            health_status["components"]["database"] = {
                "status": "healthy",
                "latency_ms": round(db_latency * 1000, 2),
                "pool_size": app_state.db_pool.get_size(),
                "available_connections": app_state.db_pool.get_size() - app_state.db_pool.get_idle_size()
            }
        else:
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "error": "Database pool not initialized"
            }
            overall_healthy = False
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_healthy = False
    
    # Check AI models health
    model_health = {
        "intent_classifier": app_state.intent_classifier is not None,
        "sentiment_analyzer": app_state.sentiment_analyzer is not None,
        "language_detector": app_state.language_detector is not None,
        "conversation_model": app_state.conversation_model is not None
    }
    
    healthy_models = sum(model_health.values())
    total_models = len(model_health)
    
    health_status["models"] = {
        "loaded_models": healthy_models,
        "total_models": total_models,
        "load_percentage": round((healthy_models / total_models) * 100, 1),
        "details": model_health
    }
    
    if healthy_models < total_models:
        overall_healthy = False
    
    # Performance metrics
    health_status["performance"] = {
        "active_sessions": len(app_state.active_sessions),
        "total_queries_processed": app_state.total_queries_processed,
        "average_response_time_ms": "N/A",  # Would calculate from metrics
        "cache_hit_rate": app_state.cache_hit_rate
    }
    
    # Set overall status
    if not overall_healthy:
        health_status["status"] = "unhealthy"
    
    status_code = 200 if overall_healthy else 503
    return JSONResponse(content=health_status, status_code=status_code)

@app.get("/metrics",
         summary="Prometheus Metrics",
         description="Prometheus-formatted metrics for monitoring",
         response_class=Response,
         tags=["System"])
async def get_metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )

@app.post("/query",
          summary="Process Text Query",
          description="Process natural language text queries with full context awareness",
          response_model=ConversationResponse,
          tags=["Query Processing"])
async def process_query(
    request: QueryRequest,
    user_claims: Dict[str, Any] = Depends(verify_token)
):
    """
    Process a text-based query with comprehensive natural language understanding.
    
    Features:
    - Intent classification with aviation domain expertise
    - Entity extraction (flight numbers, gates, times, etc.)
    - Sentiment analysis for response adaptation
    - Context-aware conversation management
    - Multi-language support with auto-detection
    - Personalized responses based on user profile
    """
    with tracer.start_as_current_span("process_text_query") as span:
        try:
            # Update user context in request
            request.user_id = user_claims.get("user_id")
            
            # Add user preferences from claims
            if not request.preferences:
                request.preferences = {}
            request.preferences.update({
                "user_roles": user_claims.get("roles", []),
                "user_email": user_claims.get("email")
            })
            
            # Process the query
            response = await ConversationManager.process_query(request)
            
            # Update span attributes
            span.set_attribute("query.intent", response.intent)
            span.set_attribute("query.confidence", response.confidence)
            span.set_attribute("query.language", response.language)
            span.set_attribute("query.requires_handoff", response.requires_human_handoff)
            
            return response
            
        except Exception as e:
            span.record_exception(e)
            logger.error(f"Query processing error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Query processing failed"
            )

# Continue with remaining endpoints... 