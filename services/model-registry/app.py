#!/usr/bin/env python3
"""
AeroFusionXR Model Registry Service
Manages ML models, versions, deployments, and lifecycle
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import boto3
from botocore.exceptions import ClientError
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
import mlflow
from mlflow.tracking import MlflowClient
import joblib
import pickle
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
POSTGRES_URI = os.getenv('POSTGRES_URI', 'postgresql://user:password@localhost:5432/modelregistry')
S3_BUCKET = os.getenv('S3_BUCKET', 'aerofusion-models')
MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI', 'sqlite:///mlflow.db')

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
model_registry_requests = Counter('model_registry_requests_total', 'Total registry requests', ['method', 'endpoint'])
model_upload_duration = Histogram('model_upload_duration_seconds', 'Model upload duration')
model_download_duration = Histogram('model_download_duration_seconds', 'Model download duration')
active_models = Gauge('active_models_total', 'Total number of active models')
model_predictions = Counter('model_predictions_total', 'Total model predictions', ['model_name', 'version'])

# ================================
# DATA MODELS
# ================================

class ModelMetadata(BaseModel):
    name: str = Field(..., description="Model name")
    version: str = Field(..., description="Model version")
    description: str = Field(..., description="Model description")
    framework: str = Field(..., description="ML framework (scikit-learn, tensorflow, pytorch, etc.)")
    algorithm: str = Field(..., description="Algorithm type")
    tags: Dict[str, str] = Field(default_factory=dict, description="Model tags")
    metrics: Dict[str, float] = Field(default_factory=dict, description="Model performance metrics")
    hyperparameters: Dict[str, Any] = Field(default_factory=dict, description="Model hyperparameters")
    features: List[str] = Field(default_factory=list, description="Input feature names")
    target: Optional[str] = Field(None, description="Target variable name")
    created_by: str = Field(..., description="Model creator")

class ModelVersion(BaseModel):
    id: str
    name: str
    version: str
    status: str  # 'staging', 'production', 'archived'
    file_path: str
    file_size: int
    file_hash: str
    metadata: ModelMetadata
    created_at: datetime
    updated_at: datetime
    downloaded_count: int
    last_used: Optional[datetime]

class ModelDeployment(BaseModel):
    id: str
    model_name: str
    model_version: str
    environment: str  # 'staging', 'production'
    endpoint_url: str
    status: str  # 'deploying', 'running', 'failed', 'stopped'
    created_at: datetime
    updated_at: datetime

class PredictionRequest(BaseModel):
    model_name: str
    model_version: str
    features: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class PredictionResponse(BaseModel):
    prediction: Any
    confidence: Optional[float] = None
    model_name: str
    model_version: str
    timestamp: datetime
    processing_time_ms: float

# ================================
# FASTAPI APP
# ================================

app = FastAPI(
    title="AeroFusionXR Model Registry",
    description="ML Model Registry and Management Service",
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

# MLflow client
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
mlflow_client = MlflowClient()

# ================================
# SERVICE CLASS
# ================================

class ModelRegistryService:
    def __init__(self):
        self.models_cache = {}
        self.ensure_database_schema()
    
    def ensure_database_schema(self):
        """Create database tables if they don't exist"""
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS models (
                        id VARCHAR PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        version VARCHAR NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'staging',
                        file_path VARCHAR NOT NULL,
                        file_size BIGINT NOT NULL,
                        file_hash VARCHAR NOT NULL,
                        metadata JSONB NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        downloaded_count INTEGER DEFAULT 0,
                        last_used TIMESTAMP,
                        UNIQUE(name, version)
                    )
                """)
                
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS deployments (
                        id VARCHAR PRIMARY KEY,
                        model_name VARCHAR NOT NULL,
                        model_version VARCHAR NOT NULL,
                        environment VARCHAR NOT NULL,
                        endpoint_url VARCHAR NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'deploying',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_models_name_version ON models(name, version);
                    CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
                    CREATE INDEX IF NOT EXISTS idx_deployments_model ON deployments(model_name, model_version);
                """)
                
                conn.commit()
    
    @tracer.start_as_current_span("register_model")
    async def register_model(
        self, 
        file: UploadFile, 
        metadata: ModelMetadata
    ) -> ModelVersion:
        """Register a new model version"""
        
        # Generate model ID
        model_id = f"{metadata.name}_{metadata.version}_{int(datetime.now().timestamp())}"
        
        # Read and validate file
        file_content = await file.read()
        file_size = len(file_content)
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Upload to S3
        s3_key = f"models/{metadata.name}/{metadata.version}/{file.filename}"
        
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=file_content,
                ContentType='application/octet-stream',
                Metadata={
                    'model-name': metadata.name,
                    'model-version': metadata.version,
                    'created-by': metadata.created_by,
                    'file-hash': file_hash
                }
            )
        except ClientError as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload model: {str(e)}")
        
        # Store in database
        model_data = {
            'id': model_id,
            'name': metadata.name,
            'version': metadata.version,
            'file_path': s3_key,
            'file_size': file_size,
            'file_hash': file_hash,
            'metadata': metadata.dict()
        }
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO models (id, name, version, file_path, file_size, file_hash, metadata)
                    VALUES (%(id)s, %(name)s, %(version)s, %(file_path)s, %(file_size)s, %(file_hash)s, %(metadata)s)
                """, model_data)
                conn.commit()
        
        # Register with MLflow
        try:
            with mlflow.start_run():
                mlflow.log_params(metadata.hyperparameters)
                mlflow.log_metrics(metadata.metrics)
                mlflow.set_tags(metadata.tags)
        except Exception as e:
            print(f"MLflow registration failed: {e}")
        
        # Cache model info
        cache_key = f"model:{metadata.name}:{metadata.version}"
        redis_client.setex(
            cache_key, 
            3600,  # 1 hour TTL
            json.dumps(model_data, default=str)
        )
        
        # Update metrics
        active_models.inc()
        
        return ModelVersion(
            id=model_id,
            name=metadata.name,
            version=metadata.version,
            status='staging',
            file_path=s3_key,
            file_size=file_size,
            file_hash=file_hash,
            metadata=metadata,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            downloaded_count=0,
            last_used=None
        )
    
    @tracer.start_as_current_span("get_model")
    async def get_model(self, name: str, version: str) -> Optional[ModelVersion]:
        """Get model by name and version"""
        
        # Check cache first
        cache_key = f"model:{name}:{version}"
        cached = redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            return ModelVersion(**data)
        
        # Query database
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT * FROM models 
                    WHERE name = %s AND version = %s
                """, (name, version))
                
                row = cur.fetchone()
                if not row:
                    return None
                
                # Update last_used timestamp
                cur.execute("""
                    UPDATE models 
                    SET last_used = CURRENT_TIMESTAMP 
                    WHERE id = %s
                """, (row['id'],))
                conn.commit()
                
                model = ModelVersion(
                    id=row['id'],
                    name=row['name'],
                    version=row['version'],
                    status=row['status'],
                    file_path=row['file_path'],
                    file_size=row['file_size'],
                    file_hash=row['file_hash'],
                    metadata=ModelMetadata(**row['metadata']),
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    downloaded_count=row['downloaded_count'],
                    last_used=row['last_used']
                )
                
                # Cache result
                redis_client.setex(
                    cache_key, 
                    3600,
                    json.dumps(model.dict(), default=str)
                )
                
                return model
    
    @tracer.start_as_current_span("download_model")
    async def download_model(self, name: str, version: str) -> bytes:
        """Download model file"""
        
        model = await self.get_model(name, version)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=model.file_path)
            model_data = response['Body'].read()
            
            # Update download count
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE models 
                        SET downloaded_count = downloaded_count + 1,
                            last_used = CURRENT_TIMESTAMP
                        WHERE name = %s AND version = %s
                    """, (name, version))
                    conn.commit()
            
            return model_data
            
        except ClientError as e:
            raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}")
    
    @tracer.start_as_current_span("predict")
    async def predict(self, request: PredictionRequest) -> PredictionResponse:
        """Make prediction using registered model"""
        
        start_time = datetime.now()
        
        # Get model
        model = await self.get_model(request.model_name, request.model_version)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Check if model is cached in memory
        cache_key = f"loaded_model:{request.model_name}:{request.model_version}"
        
        if cache_key not in self.models_cache:
            # Download and load model
            model_data = await self.download_model(request.model_name, request.model_version)
            
            try:
                # Try different loading methods based on framework
                if model.metadata.framework.lower() == 'scikit-learn':
                    loaded_model = joblib.loads(model_data)
                elif model.metadata.framework.lower() in ['tensorflow', 'keras']:
                    # For TensorFlow models, would need tf.keras.models.load_model
                    raise HTTPException(status_code=501, detail="TensorFlow models not supported yet")
                elif model.metadata.framework.lower() == 'pytorch':
                    # For PyTorch models, would need torch.load
                    raise HTTPException(status_code=501, detail="PyTorch models not supported yet")
                else:
                    # Try pickle as fallback
                    loaded_model = pickle.loads(model_data)
                
                self.models_cache[cache_key] = loaded_model
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")
        
        loaded_model = self.models_cache[cache_key]
        
        try:
            # Convert features to the format expected by the model
            feature_values = [request.features.get(feature, 0) for feature in model.metadata.features]
            
            # Make prediction
            if hasattr(loaded_model, 'predict_proba'):
                prediction = loaded_model.predict_proba([feature_values])[0]
                confidence = float(max(prediction))
                prediction = int(prediction.argmax())
            elif hasattr(loaded_model, 'predict'):
                prediction = loaded_model.predict([feature_values])[0]
                confidence = None
                # Convert numpy types to native Python types
                if hasattr(prediction, 'item'):
                    prediction = prediction.item()
            else:
                raise HTTPException(status_code=500, detail="Model does not support prediction")
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Update metrics
            model_predictions.labels(
                model_name=request.model_name, 
                version=request.model_version
            ).inc()
            
            return PredictionResponse(
                prediction=prediction,
                confidence=confidence,
                model_name=request.model_name,
                model_version=request.model_version,
                timestamp=datetime.now(),
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# Initialize service
model_registry = ModelRegistryService()

# ================================
# API ENDPOINTS
# ================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "model-registry",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/models", response_model=ModelVersion)
async def register_model(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = None,
    version: str = None,
    description: str = None,
    framework: str = None,
    algorithm: str = None,
    created_by: str = None
):
    """Register a new model version"""
    
    if not all([name, version, description, framework, algorithm, created_by]):
        raise HTTPException(
            status_code=400, 
            detail="Missing required parameters: name, version, description, framework, algorithm, created_by"
        )
    
    metadata = ModelMetadata(
        name=name,
        version=version,
        description=description,
        framework=framework,
        algorithm=algorithm,
        created_by=created_by
    )
    
    with model_upload_duration.time():
        result = await model_registry.register_model(file, metadata)
    
    model_registry_requests.labels(method="POST", endpoint="/models").inc()
    
    return result

@app.get("/models/{name}/versions/{version}", response_model=ModelVersion)
async def get_model(name: str, version: str):
    """Get model by name and version"""
    
    model = await model_registry.get_model(name, version)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    model_registry_requests.labels(method="GET", endpoint="/models/{name}/versions/{version}").inc()
    
    return model

@app.get("/models/{name}/versions/{version}/download")
async def download_model(name: str, version: str):
    """Download model file"""
    
    with model_download_duration.time():
        model_data = await model_registry.download_model(name, version)
    
    model_registry_requests.labels(method="GET", endpoint="/models/{name}/versions/{version}/download").inc()
    
    return JSONResponse(
        content={"message": "Model downloaded successfully"},
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Length": str(len(model_data))
        }
    )

@app.post("/models/{name}/versions/{version}/predict", response_model=PredictionResponse)
async def predict(name: str, version: str, request: PredictionRequest):
    """Make prediction using model"""
    
    # Override model name/version from URL
    request.model_name = name
    request.model_version = version
    
    result = await model_registry.predict(request)
    
    model_registry_requests.labels(method="POST", endpoint="/models/{name}/versions/{version}/predict").inc()
    
    return result

@app.get("/models")
async def list_models(
    limit: int = 50,
    offset: int = 0,
    status: str = None
):
    """List all models"""
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            where_clause = ""
            params = []
            
            if status:
                where_clause = "WHERE status = %s"
                params.append(status)
            
            cur.execute(f"""
                SELECT * FROM models 
                {where_clause}
                ORDER BY created_at DESC 
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            
            models = cur.fetchall()
            
            # Get total count
            cur.execute(f"SELECT COUNT(*) as total FROM models {where_clause}", params)
            total = cur.fetchone()['total']
    
    model_registry_requests.labels(method="GET", endpoint="/models").inc()
    
    return {
        "models": models,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.delete("/models/{name}/versions/{version}")
async def delete_model(name: str, version: str):
    """Delete model version"""
    
    model = await model_registry.get_model(name, version)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Delete from S3
    try:
        s3_client.delete_object(Bucket=S3_BUCKET, Key=model.file_path)
    except ClientError as e:
        print(f"Failed to delete from S3: {e}")
    
    # Delete from database
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM models 
                WHERE name = %s AND version = %s
            """, (name, version))
            conn.commit()
    
    # Remove from cache
    cache_key = f"model:{name}:{version}"
    redis_client.delete(cache_key)
    
    # Update metrics
    active_models.dec()
    
    model_registry_requests.labels(method="DELETE", endpoint="/models/{name}/versions/{version}").inc()
    
    return {"message": "Model deleted successfully"}

# ================================
# STARTUP/SHUTDOWN
# ================================

@app.on_event("startup")
async def startup():
    """Startup tasks"""
    print("Model Registry service starting...")
    
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
    
    # Test S3 connection
    try:
        s3_client.list_objects_v2(Bucket=S3_BUCKET, MaxKeys=1)
        print("✓ S3 connection successful")
    except Exception as e:
        print(f"✗ S3 connection failed: {e}")
    
    print("Model Registry service started successfully")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup tasks"""
    print("Model Registry service shutting down...")
    
    # Clear model cache
    model_registry.models_cache.clear()
    
    print("Model Registry service shut down successfully")

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