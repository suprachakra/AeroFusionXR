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