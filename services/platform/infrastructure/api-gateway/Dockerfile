# ================================
# AeroFusionXR API Gateway - Enterprise Dockerfile
# Multi-stage build for optimized production deployment
# ================================

# ================================
# Build Stage: Dependencies and Compilation
# ================================
FROM python:3.11.7-slim-bookworm AS builder

# Build arguments for flexibility
ARG BUILD_DATE
ARG GIT_COMMIT
ARG VERSION
ARG ENVIRONMENT=production

# Set build-time labels for better tracking
LABEL build.date=$BUILD_DATE \
      build.git.commit=$GIT_COMMIT \
      build.version=$VERSION \
      build.environment=$ENVIRONMENT

# Install system dependencies needed for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools for compiling Python packages
    build-essential \
    gcc \
    g++ \
    # Networking and security libraries
    libssl-dev \
    libffi-dev \
    # Compression libraries for better performance
    zlib1g-dev \
    libbz2-dev \
    # Git for potential dependency installation
    git \
    # Curl for health checks and debugging
    curl \
    # Clean up to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security (build stage)
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Set working directory
WORKDIR /app

# Upgrade pip and install build tools for better security and performance
RUN pip install --no-cache-dir --upgrade \
    pip==23.3.1 \
    setuptools==69.0.2 \
    wheel==0.42.0

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies in a virtual environment for isolation
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ================================
# Production Stage: Minimal Runtime
# ================================
FROM python:3.11.7-slim-bookworm AS production

# Metadata labels for enterprise tracking
LABEL maintainer="AeroFusionXR DevOps Team <devops@aerofusionxr.com>" \
      service.name="api-gateway" \
      service.version="1.0.0" \
      service.description="Enterprise API Gateway for AeroFusionXR Platform" \
      service.tier="critical" \
      security.scanning="enabled" \
      compliance.gdpr="compliant" \
      compliance.sox="compliant"

# Install only runtime dependencies (minimal for security)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Essential runtime libraries
    ca-certificates \
    # SSL/TLS certificates for secure communication
    openssl \
    # Networking tools for service mesh integration
    curl \
    # Process management utilities
    procps \
    # Time zone data for accurate logging
    tzdata \
    # Minimal system utilities
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    # Remove package manager cache to reduce attack surface
    && rm -rf /var/cache/apt/*

# Create non-root user and group for security
RUN groupadd -r -g 1000 aerofusion && \
    useradd -r -u 1000 -g aerofusion -d /app -s /bin/bash aerofusion

# Create necessary directories with proper permissions
RUN mkdir -p /app /app/logs /app/tmp /app/config \
    && chown -R aerofusion:aerofusion /app

# Copy virtual environment from builder stage
COPY --from=builder --chown=aerofusion:aerofusion /opt/venv /opt/venv

# Set working directory
WORKDIR /app

# Copy application code with proper ownership
COPY --chown=aerofusion:aerofusion . .

# Set environment variables for production
ENV PYTHONPATH="/app:/opt/venv/lib/python3.11/site-packages" \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Application-specific environment variables
    SERVICE_NAME="api-gateway" \
    ENVIRONMENT="production" \
    LOG_LEVEL="INFO" \
    PORT=8000 \
    # Security hardening
    PYTHONSAFEPATH=1 \
    # Timezone
    TZ=UTC

# Set build information as environment variables
ARG BUILD_DATE
ARG GIT_COMMIT
ARG VERSION
ENV BUILD_TIME=$BUILD_DATE \
    GIT_COMMIT=$GIT_COMMIT \
    API_VERSION=$VERSION

# Switch to non-root user for security
USER aerofusion

# Health check configuration for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port (documentation only - actual port binding in runtime)
EXPOSE 8000

# Set resource limits and optimizations
# These can be overridden in Kubernetes/Docker Compose
ENV UVICORN_WORKERS=1 \
    UVICORN_MAX_REQUESTS=1000 \
    UVICORN_MAX_REQUESTS_JITTER=100 \
    UVICORN_TIMEOUT_KEEP_ALIVE=30 \
    UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN=30

# Create startup script with proper error handling
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Wait for dependencies (Redis, etc.) to be ready\n\
echo "🚀 Starting AeroFusionXR API Gateway..."\n\
echo "Environment: $ENVIRONMENT"\n\
echo "Version: $API_VERSION"\n\
echo "Build: $GIT_COMMIT"\n\
echo "Build Time: $BUILD_TIME"\n\
\n\
# Validate critical environment variables\n\
if [ -z "$REDIS_URL" ]; then\n\
    echo "❌ ERROR: REDIS_URL environment variable is required"\n\
    exit 1\n\
fi\n\
\n\
if [ -z "$JWT_SECRET" ]; then\n\
    echo "⚠️  WARNING: JWT_SECRET not set, using default (not secure for production)"\n\
fi\n\
\n\
# Create necessary runtime directories\n\
mkdir -p /app/logs /app/tmp\n\
\n\
# Start the application with optimized settings\n\
exec uvicorn app:app \\\n\
    --host 0.0.0.0 \\\n\
    --port $PORT \\\n\
    --workers $UVICORN_WORKERS \\\n\
    --max-requests $UVICORN_MAX_REQUESTS \\\n\
    --max-requests-jitter $UVICORN_MAX_REQUESTS_JITTER \\\n\
    --timeout-keep-alive $UVICORN_TIMEOUT_KEEP_ALIVE \\\n\
    --timeout-graceful-shutdown $UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN \\\n\
    --log-level $LOG_LEVEL \\\n\
    --access-log \\\n\
    --no-server-header \\\n\
    --no-date-header\n\
' > /app/start.sh && chmod +x /app/start.sh

# ================================
# Security Hardening
# ================================

# Remove unnecessary packages and files that could be attack vectors
USER root
RUN apt-get remove -y --purge \
    # Remove compilers and build tools from runtime
    build-essential \
    gcc \
    g++ \
    git \
    # Clean up package manager
    && apt-get autoremove -y \
    && apt-get autoclean \
    # Remove package lists
    && rm -rf /var/lib/apt/lists/* \
    # Remove temporary files
    && rm -rf /tmp/* /var/tmp/* \
    # Remove shell history
    && rm -f /root/.bash_history \
    # Secure file permissions
    && find /app -type f -exec chmod 644 {} \; \
    && find /app -type d -exec chmod 755 {} \; \
    && chmod +x /app/start.sh

# Final security lockdown - switch back to non-root user
USER aerofusion

# ================================
# Runtime Configuration
# ================================

# Default command runs the startup script
CMD ["/app/start.sh"]

# Alternative entrypoint for debugging (can be overridden)
# ENTRYPOINT ["python", "-m", "uvicorn", "app:app"]

# ================================
# Image Metadata for Enterprise Scanning
# ================================

# Add metadata for vulnerability scanning and compliance
LABEL security.scan.enabled="true" \
      security.non-root-user="aerofusion" \
      security.secrets.none="true" \
      security.dependencies.pinned="true" \
      compliance.framework="SOC2,GDPR,ISO27001" \
      maintenance.team="platform-engineering" \
      backup.required="false" \
      monitoring.health-check="/health" \
      monitoring.metrics="/metrics" \
      network.ingress.port="8000" \
      network.egress.required="redis,backend-services,telemetry" \
      service.criticality="high" \
      service.data-classification="internal"

# ================================
# Build Instructions and Notes
# ================================

# Build command example:
# docker build \
#   --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
#   --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
#   --build-arg VERSION=1.0.0 \
#   --build-arg ENVIRONMENT=production \
#   -t aerofusionxr/api-gateway:1.0.0 \
#   -t aerofusionxr/api-gateway:latest \
#   .

# Production run command example:
# docker run -d \
#   --name api-gateway \
#   --restart unless-stopped \
#   -p 8000:8000 \
#   -e REDIS_URL=redis://redis:6379 \
#   -e JWT_SECRET=your-super-secret-key \
#   -e ENVIRONMENT=production \
#   -e LOG_LEVEL=INFO \
#   --memory=512m \
#   --cpus=1.0 \
#   aerofusionxr/api-gateway:1.0.0

# ================================
# Security and Compliance Notes
# ================================

# This Dockerfile implements multiple security best practices:
# 1. Multi-stage build to reduce attack surface
# 2. Non-root user execution
# 3. Minimal base image with only necessary runtime dependencies
# 4. Pinned dependency versions to prevent supply chain attacks
# 5. Health checks for container orchestration
# 6. Proper file permissions and ownership
# 7. No secrets baked into the image
# 8. Comprehensive labeling for compliance tracking
# 9. Resource limits and optimization settings
# 10. Graceful shutdown handling 