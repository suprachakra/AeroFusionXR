#!/usr/bin/env python3
"""
AeroFusionXR Feature Store Service
Manages ML features, feature engineering, serving, and monitoring
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Union
from pathlib import Path
import pandas as pd
import numpy as np

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import boto3
from botocore.exceptions import ClientError
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

# ================================
# CONFIGURATION
# ================================

# Environment configuration
ENVIRONMENT = os.getenv('PYTHON_ENV', 'development')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
POSTGRES_URI = os.getenv('POSTGRES_URI', 'postgresql://user:password@localhost:5432/featurestore')
S3_BUCKET = os.getenv('S3_BUCKET', 'aerofusion-features')

# Initialize tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

if ENVIRONMENT == 'production':
    otlp_exporter = OTLPSpanExporter(endpoint="http://jaeger:14250", insecure=True)
    span_processor = BatchSpanProcessor(otlp_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)

# ================================
# METRICS
# ================================

# Prometheus metrics
feature_requests = Counter('feature_requests_total', 'Total feature requests', ['feature_group', 'operation'])
feature_compute_duration = Histogram('feature_compute_duration_seconds', 'Feature computation duration')
feature_serving_duration = Histogram('feature_serving_duration_seconds', 'Feature serving duration')
active_features = Gauge('active_features_total', 'Total number of active features')
feature_cache_hits = Counter('feature_cache_hits_total', 'Feature cache hits', ['feature_group'])
feature_cache_misses = Counter('feature_cache_misses_total', 'Feature cache misses', ['feature_group'])

# ================================
# DATA MODELS
# ================================

class FeatureDefinition(BaseModel):
    name: str = Field(..., description="Feature name")
    description: str = Field(..., description="Feature description")
    data_type: str = Field(..., description="Data type (float, int, string, boolean)")
    source: str = Field(..., description="Data source")
    transformation: Optional[str] = Field(None, description="Transformation SQL or function")
    tags: Dict[str, str] = Field(default_factory=dict, description="Feature tags")
    created_by: str = Field(..., description="Feature creator")
    
class FeatureGroup(BaseModel):
    name: str = Field(..., description="Feature group name")
    description: str = Field(..., description="Feature group description")
    features: List[FeatureDefinition] = Field(..., description="List of features")
    entity_id_column: str = Field(..., description="Entity ID column name")
    timestamp_column: Optional[str] = Field(None, description="Timestamp column name")
    source_table: str = Field(..., description="Source table or view")
    refresh_interval: int = Field(3600, description="Refresh interval in seconds")
    tags: Dict[str, str] = Field(default_factory=dict, description="Feature group tags")
    created_by: str = Field(..., description="Feature group creator")

class FeatureValue(BaseModel):
    entity_id: str
    feature_name: str
    value: Union[str, int, float, bool]
    timestamp: datetime
    
class FeatureQuery(BaseModel):
    feature_names: List[str] = Field(..., description="List of feature names to retrieve")
    entity_ids: List[str] = Field(..., description="List of entity IDs")
    timestamp: Optional[datetime] = Field(None, description="Point-in-time for features")
    
class FeatureResponse(BaseModel):
    entity_id: str
    features: Dict[str, Any]
    timestamp: datetime
    
class FeatureStats(BaseModel):
    feature_name: str
    count: int
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    null_count: int = 0
    unique_count: Optional[int] = None
    last_updated: datetime

# ================================
# FASTAPI APP
# ================================

app = FastAPI(
    title="AeroFusionXR Feature Store",
    description="ML Feature Store and Management Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)
RedisInstrumentor().instrument()
Psycopg2Instrumentor().instrument()

# ================================
# DATABASE CONNECTIONS
# ================================

# Redis connection
redis_client = redis.from_url(REDIS_URL)

# PostgreSQL connection
def get_db_connection():
    return psycopg2.connect(POSTGRES_URI, cursor_factory=RealDictCursor)

# S3 client
s3_client = boto3.client('s3')

# ================================
# SERVICE CLASS
# ================================

class FeatureStoreService:
    def __init__(self):
        self.feature_cache = {}
        self.ensure_database_schema()
    
    def ensure_database_schema(self):
        """Create database tables if they don't exist"""
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Feature groups table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS feature_groups (
                        name VARCHAR PRIMARY KEY,
                        description TEXT NOT NULL,
                        entity_id_column VARCHAR NOT NULL,
                        timestamp_column VARCHAR,
                        source_table VARCHAR NOT NULL,
                        refresh_interval INTEGER DEFAULT 3600,
                        tags JSONB DEFAULT '{}',
                        created_by VARCHAR NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Features table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS features (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        feature_group VARCHAR NOT NULL,
                        description TEXT NOT NULL,
                        data_type VARCHAR NOT NULL,
                        source VARCHAR NOT NULL,
                        transformation TEXT,
                        tags JSONB DEFAULT '{}',
                        created_by VARCHAR NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (feature_group) REFERENCES feature_groups(name),
                        UNIQUE(feature_group, name)
                    )
                """)
                
                # Feature values table (time-series data)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS feature_values (
                        id BIGSERIAL PRIMARY KEY,
                        entity_id VARCHAR NOT NULL,
                        feature_name VARCHAR NOT NULL,
                        feature_group VARCHAR NOT NULL,
                        value_type VARCHAR NOT NULL,
                        string_value VARCHAR,
                        numeric_value DOUBLE PRECISION,
                        boolean_value BOOLEAN,
                        timestamp TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Feature statistics table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS feature_stats (
                        feature_name VARCHAR PRIMARY KEY,
                        feature_group VARCHAR NOT NULL,
                        count BIGINT NOT NULL,
                        mean DOUBLE PRECISION,
                        std DOUBLE PRECISION,
                        min DOUBLE PRECISION,
                        max DOUBLE PRECISION,
                        null_count BIGINT DEFAULT 0,
                        unique_count BIGINT,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Indexes for performance
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_feature_values_entity_feature ON feature_values(entity_id, feature_name);
                    CREATE INDEX IF NOT EXISTS idx_feature_values_timestamp ON feature_values(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_feature_values_group ON feature_values(feature_group);
                """)
                
                conn.commit()
    
    @tracer.start_as_current_span("create_feature_group")
    async def create_feature_group(self, feature_group: FeatureGroup) -> Dict[str, Any]:
        """Create a new feature group"""
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                try:
                    # Insert feature group
                    cur.execute("""
                        INSERT INTO feature_groups 
                        (name, description, entity_id_column, timestamp_column, source_table, 
                         refresh_interval, tags, created_by)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        feature_group.name,
                        feature_group.description,
                        feature_group.entity_id_column,
                        feature_group.timestamp_column,
                        feature_group.source_table,
                        feature_group.refresh_interval,
                        json.dumps(feature_group.tags),
                        feature_group.created_by
                    ))
                    
                    # Insert features
                    for feature in feature_group.features:
                        cur.execute("""
                            INSERT INTO features 
                            (name, feature_group, description, data_type, source, 
                             transformation, tags, created_by)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            feature.name,
                            feature_group.name,
                            feature.description,
                            feature.data_type,
                            feature.source,
                            feature.transformation,
                            json.dumps(feature.tags),
                            feature.created_by
                        ))
                    
                    conn.commit()
                    
                    # Update metrics
                    active_features.inc(len(feature_group.features))
                    
                    return {
                        "name": feature_group.name,
                        "features_count": len(feature_group.features),
                        "created_at": datetime.now().isoformat()
                    }
                    
                except Exception as e:
                    conn.rollback()
                    raise HTTPException(status_code=400, detail=f"Failed to create feature group: {str(e)}")
    
    @tracer.start_as_current_span("ingest_features")
    async def ingest_features(
        self, 
        feature_group: str, 
        features_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Ingest feature values into the store"""
        
        ingested_count = 0
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for record in features_data:
                    entity_id = record.get('entity_id')
                    timestamp = record.get('timestamp', datetime.now())
                    
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    
                    for feature_name, value in record.items():
                        if feature_name in ['entity_id', 'timestamp']:
                            continue
                        
                        # Determine value type and storage
                        value_type = type(value).__name__
                        string_value = None
                        numeric_value = None
                        boolean_value = None
                        
                        if isinstance(value, str):
                            value_type = 'string'
                            string_value = value
                        elif isinstance(value, (int, float)):
                            value_type = 'numeric'
                            numeric_value = float(value)
                        elif isinstance(value, bool):
                            value_type = 'boolean'
                            boolean_value = value
                        else:
                            value_type = 'string'
                            string_value = str(value)
                        
                        cur.execute("""
                            INSERT INTO feature_values 
                            (entity_id, feature_name, feature_group, value_type, 
                             string_value, numeric_value, boolean_value, timestamp)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            entity_id,
                            feature_name,
                            feature_group,
                            value_type,
                            string_value,
                            numeric_value,
                            boolean_value,
                            timestamp
                        ))
                        
                        ingested_count += 1
                
                conn.commit()
        
        # Update feature statistics
        await self.update_feature_stats(feature_group)
        
        return {
            "feature_group": feature_group,
            "records_processed": len(features_data),
            "features_ingested": ingested_count,
            "timestamp": datetime.now().isoformat()
        }
    
    @tracer.start_as_current_span("get_features")
    async def get_features(self, query: FeatureQuery) -> List[FeatureResponse]:
        """Get feature values for entities"""
        
        # Check cache first
        cache_keys = []
        for entity_id in query.entity_ids:
            cache_key = f"features:{':'.join(sorted(query.feature_names))}:{entity_id}"
            if query.timestamp:
                cache_key += f":{query.timestamp.isoformat()}"
            cache_keys.append(cache_key)
        
        # Try to get from cache
        cached_results = []
        cache_misses = []
        
        for i, cache_key in enumerate(cache_keys):
            cached = redis_client.get(cache_key)
            if cached:
                cached_results.append((query.entity_ids[i], json.loads(cached)))
                feature_cache_hits.labels(feature_group="mixed").inc()
            else:
                cache_misses.append(query.entity_ids[i])
                feature_cache_misses.labels(feature_group="mixed").inc()
        
        # Query database for cache misses
        db_results = []
        if cache_misses:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Build query based on whether timestamp is specified
                    if query.timestamp:
                        # Point-in-time query
                        cur.execute("""
                            SELECT DISTINCT ON (entity_id, feature_name) 
                                   entity_id, feature_name, value_type,
                                   string_value, numeric_value, boolean_value, timestamp
                            FROM feature_values
                            WHERE entity_id = ANY(%s) 
                              AND feature_name = ANY(%s)
                              AND timestamp <= %s
                            ORDER BY entity_id, feature_name, timestamp DESC
                        """, (cache_misses, query.feature_names, query.timestamp))
                    else:
                        # Latest values
                        cur.execute("""
                            SELECT DISTINCT ON (entity_id, feature_name) 
                                   entity_id, feature_name, value_type,
                                   string_value, numeric_value, boolean_value, timestamp
                            FROM feature_values
                            WHERE entity_id = ANY(%s) 
                              AND feature_name = ANY(%s)
                            ORDER BY entity_id, feature_name, timestamp DESC
                        """, (cache_misses, query.feature_names))
                    
                    rows = cur.fetchall()
                    
                    # Group by entity_id
                    entity_features = {}
                    for row in rows:
                        entity_id = row['entity_id']
                        feature_name = row['feature_name']
                        
                        # Extract value based on type
                        if row['value_type'] == 'string':
                            value = row['string_value']
                        elif row['value_type'] == 'numeric':
                            value = row['numeric_value']
                        elif row['value_type'] == 'boolean':
                            value = row['boolean_value']
                        else:
                            value = None
                        
                        if entity_id not in entity_features:
                            entity_features[entity_id] = {}
                        
                        entity_features[entity_id][feature_name] = value
                    
                    # Create results for cache misses
                    for entity_id in cache_misses:
                        features = entity_features.get(entity_id, {})
                        
                        # Fill missing features with None
                        for feature_name in query.feature_names:
                            if feature_name not in features:
                                features[feature_name] = None
                        
                        db_results.append((entity_id, features))
                        
                        # Cache the result
                        cache_key = f"features:{':'.join(sorted(query.feature_names))}:{entity_id}"
                        if query.timestamp:
                            cache_key += f":{query.timestamp.isoformat()}"
                        
                        redis_client.setex(
                            cache_key,
                            300,  # 5 minutes TTL
                            json.dumps(features, default=str)
                        )
        
        # Combine cached and DB results
        all_results = cached_results + db_results
        
        # Convert to response format
        responses = []
        for entity_id, features in all_results:
            responses.append(FeatureResponse(
                entity_id=entity_id,
                features=features,
                timestamp=query.timestamp or datetime.now()
            ))
        
        return responses
    
    @tracer.start_as_current_span("update_feature_stats")
    async def update_feature_stats(self, feature_group: str):
        """Update feature statistics"""
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Get all features in the group
                cur.execute("""
                    SELECT name FROM features WHERE feature_group = %s
                """, (feature_group,))
                
                features = cur.fetchall()
                
                for feature in features:
                    feature_name = feature['name']
                    
                    # Calculate statistics for numeric features
                    cur.execute("""
                        SELECT 
                            COUNT(*) as count,
                            AVG(numeric_value) as mean,
                            STDDEV(numeric_value) as std,
                            MIN(numeric_value) as min,
                            MAX(numeric_value) as max,
                            COUNT(*) FILTER (WHERE numeric_value IS NULL 
                                             AND string_value IS NULL 
                                             AND boolean_value IS NULL) as null_count,
                            COUNT(DISTINCT COALESCE(string_value, numeric_value::text, boolean_value::text)) as unique_count
                        FROM feature_values
                        WHERE feature_name = %s AND feature_group = %s
                    """, (feature_name, feature_group))
                    
                    stats = cur.fetchone()
                    
                    # Upsert statistics
                    cur.execute("""
                        INSERT INTO feature_stats 
                        (feature_name, feature_group, count, mean, std, min, max, null_count, unique_count)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (feature_name) 
                        DO UPDATE SET
                            count = EXCLUDED.count,
                            mean = EXCLUDED.mean,
                            std = EXCLUDED.std,
                            min = EXCLUDED.min,
                            max = EXCLUDED.max,
                            null_count = EXCLUDED.null_count,
                            unique_count = EXCLUDED.unique_count,
                            last_updated = CURRENT_TIMESTAMP
                    """, (
                        feature_name,
                        feature_group,
                        stats['count'],
                        stats['mean'],
                        stats['std'],
                        stats['min'],
                        stats['max'],
                        stats['null_count'],
                        stats['unique_count']
                    ))
                
                conn.commit()

# Initialize service
feature_store = FeatureStoreService()

# ================================
# API ENDPOINTS
# ================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "feature-store",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/feature-groups")
async def create_feature_group(feature_group: FeatureGroup):
    """Create a new feature group"""
    
    result = await feature_store.create_feature_group(feature_group)
    feature_requests.labels(feature_group=feature_group.name, operation="create").inc()
    
    return result

@app.post("/feature-groups/{feature_group}/ingest")
async def ingest_features(
    feature_group: str,
    features_data: List[Dict[str, Any]]
):
    """Ingest feature values"""
    
    with feature_compute_duration.time():
        result = await feature_store.ingest_features(feature_group, features_data)
    
    feature_requests.labels(feature_group=feature_group, operation="ingest").inc()
    
    return result

@app.post("/features/query", response_model=List[FeatureResponse])
async def query_features(query: FeatureQuery):
    """Query feature values"""
    
    with feature_serving_duration.time():
        results = await feature_store.get_features(query)
    
    feature_requests.labels(feature_group="mixed", operation="query").inc()
    
    return results

@app.get("/feature-groups")
async def list_feature_groups():
    """List all feature groups"""
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT fg.*, COUNT(f.id) as feature_count
                FROM feature_groups fg
                LEFT JOIN features f ON fg.name = f.feature_group
                GROUP BY fg.name
                ORDER BY fg.created_at DESC
            """)
            
            feature_groups = cur.fetchall()
    
    return {"feature_groups": feature_groups}

@app.get("/feature-groups/{feature_group}/features")
async def list_features(feature_group: str):
    """List features in a feature group"""
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM features WHERE feature_group = %s
                ORDER BY created_at DESC
            """, (feature_group,))
            
            features = cur.fetchall()
    
    return {"features": features}

@app.get("/features/{feature_name}/stats", response_model=FeatureStats)
async def get_feature_stats(feature_name: str):
    """Get feature statistics"""
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM feature_stats WHERE feature_name = %s
            """, (feature_name,))
            
            stats = cur.fetchone()
            
            if not stats:
                raise HTTPException(status_code=404, detail="Feature statistics not found")
    
    return FeatureStats(**stats)

@app.delete("/feature-groups/{feature_group}")
async def delete_feature_group(feature_group: str):
    """Delete a feature group and all its features"""
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Delete in order: feature_values, feature_stats, features, feature_groups
            cur.execute("DELETE FROM feature_values WHERE feature_group = %s", (feature_group,))
            cur.execute("DELETE FROM feature_stats WHERE feature_group = %s", (feature_group,))
            cur.execute("DELETE FROM features WHERE feature_group = %s", (feature_group,))
            cur.execute("DELETE FROM feature_groups WHERE name = %s", (feature_group,))
            
            conn.commit()
    
    return {"message": "Feature group deleted successfully"}

# ================================
# STARTUP/SHUTDOWN
# ================================

@app.on_event("startup")
async def startup():
    """Startup tasks"""
    print("Feature Store service starting...")
    
    # Test database connection
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        print("✓ Database connection successful")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
    
    # Test Redis connection
    try:
        redis_client.ping()
        print("✓ Redis connection successful")
    except Exception as e:
        print(f"✗ Redis connection failed: {e}")
    
    print("Feature Store service started successfully")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup tasks"""
    print("Feature Store service shutting down...")
    
    # Clear feature cache
    feature_store.feature_cache.clear()
    
    print("Feature Store service shut down successfully")

# ================================
# MAIN
# ================================

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=ENVIRONMENT == "development",
        log_level="info"
    ) 