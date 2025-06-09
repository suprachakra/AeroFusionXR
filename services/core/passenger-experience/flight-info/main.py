"""
AeroFusionXR Flight Information Service
======================================

Enterprise-grade real-time flight tracking and analytics service for the AeroFusionXR Aviation Platform.

Features:
- 🛫 Real-time flight status tracking from multiple data sources
- 📊 Predictive delay analytics and machine learning models
- 🌤️ Weather impact analysis and integration
- 🔔 Intelligent notification and alert system
- 📈 Historical analytics and performance metrics
- 🗺️ Live flight tracking with position updates
- 🔄 Multi-vendor data aggregation with failover
- 📱 WebSocket real-time updates
- 🛡️ Enterprise security and rate limiting
- 📋 Comprehensive API for all aviation data needs

Architecture:
- FastAPI with async/await for high-performance processing
- Redis for real-time caching and pub/sub messaging
- PostgreSQL for flight data storage and analytics
- MongoDB for unstructured flight metadata
- Machine Learning models for delay prediction
- Multiple vendor API integrations (FlightAware, FlightRadar24, etc.)
- Real-time WebSocket broadcasting
- Comprehensive observability and monitoring

Author: AeroFusionXR Team
License: Proprietary
"""

import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
from enum import Enum

import aiofiles
import aioredis
import asyncpg
import httpx
import pandas as pd
import numpy as np
from fastapi import (
    FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect,
    BackgroundTasks, Request, Response, Query, Path
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from pydantic import BaseModel, Field, validator
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio_mqtt
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib

# ================================
# CONFIGURATION & INITIALIZATION
# ================================

# Environment configuration with secure defaults
CONFIG = {
    "SERVICE_NAME": "flight-info",
    "VERSION": "1.0.0",
    "PORT": int(os.getenv("PORT", 8001)),
    "REDIS_URL": os.getenv("REDIS_URL", "redis://localhost:6379"),
    "DATABASE_URL": os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/flightinfo"),
    "MONGODB_URL": os.getenv("MONGODB_URL", "mongodb://localhost:27017/flightinfo"),
    "WEATHER_API_KEY": os.getenv("WEATHER_API_KEY", ""),
    "FLIGHTAWARE_API_KEY": os.getenv("FLIGHTAWARE_API_KEY", ""),
    "FLIGHTRADAR24_API_KEY": os.getenv("FLIGHTRADAR24_API_KEY", ""),
    "AVIATIONSTACK_API_KEY": os.getenv("AVIATIONSTACK_API_KEY", ""),
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "CACHE_TTL_SECONDS": int(os.getenv("CACHE_TTL_SECONDS", 300)),
    "UPDATE_INTERVAL_SECONDS": int(os.getenv("UPDATE_INTERVAL_SECONDS", 30)),
    "PREDICTION_HORIZON_HOURS": int(os.getenv("PREDICTION_HORIZON_HOURS", 24)),
    "MAX_HISTORICAL_DAYS": int(os.getenv("MAX_HISTORICAL_DAYS", 365)),
    "VENDOR_TIMEOUT_SECONDS": int(os.getenv("VENDOR_TIMEOUT_SECONDS", 10)),
    "MAX_CONCURRENT_UPDATES": int(os.getenv("MAX_CONCURRENT_UPDATES", 100)),
    "ENABLE_ML_PREDICTIONS": os.getenv("ENABLE_ML_PREDICTIONS", "true").lower() == "true",
    "ENABLE_WEATHER_INTEGRATION": os.getenv("ENABLE_WEATHER_INTEGRATION", "true").lower() == "true"
}

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, CONFIG["LOG_LEVEL"]),
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "service": "flight-info", "message": "%(message)s", "module": "%(name)s"}',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configure OpenTelemetry distributed tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Configure OTLP trace exporter
otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:14268/api/traces"),
    insecure=True
)
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Configure Prometheus metrics
METRICS = {
    "flights_tracked": Gauge(
        "flight_info_flights_tracked_total",
        "Total number of flights being tracked"
    ),
    "data_requests": Counter(
        "flight_info_data_requests_total",
        "Total data requests processed",
        ["vendor", "status", "type"]
    ),
    "response_time": Histogram(
        "flight_info_response_time_seconds",
        "Response time for flight data requests",
        ["endpoint", "vendor"]
    ),
    "delay_predictions": Counter(
        "flight_info_delay_predictions_total",
        "Total delay predictions made",
        ["accuracy_tier"]
    ),
    "weather_impact_events": Counter(
        "flight_info_weather_events_total",
        "Weather events impacting flights",
        ["severity", "event_type"]
    ),
    "ml_model_accuracy": Gauge(
        "flight_info_ml_accuracy",
        "Machine learning model accuracy score"
    ),
    "cache_hit_ratio": Gauge(
        "flight_info_cache_hit_ratio",
        "Cache hit ratio for flight data"
    ),
    "vendor_availability": Gauge(
        "flight_info_vendor_availability",
        "Vendor API availability status",
        ["vendor"]
    ),
    "websocket_connections": Gauge(
        "flight_info_websocket_connections",
        "Active WebSocket connections"
    ),
    "data_freshness": Histogram(
        "flight_info_data_freshness_seconds",
        "Age of flight data in seconds",
        ["data_type"]
    )
}

# ================================
# DATA MODELS & ENUMS
# ================================

class FlightStatus(str, Enum):
    """Flight status enumeration with comprehensive status types."""
    SCHEDULED = "SCHEDULED"
    BOARDING = "BOARDING"
    DEPARTED = "DEPARTED"
    IN_AIR = "IN_AIR"
    APPROACHING = "APPROACHING"
    LANDED = "LANDED"
    ARRIVED = "ARRIVED"
    DELAYED = "DELAYED"
    CANCELLED = "CANCELLED"
    DIVERTED = "DIVERTED"
    RETURNED = "RETURNED"
    EMERGENCY = "EMERGENCY"
    UNKNOWN = "UNKNOWN"

class WeatherSeverity(str, Enum):
    """Weather severity classification."""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"

class DelayCategory(str, Enum):
    """Delay categorization for analytics."""
    WEATHER = "WEATHER"
    MECHANICAL = "MECHANICAL"
    CREW = "CREW"
    AIR_TRAFFIC = "AIR_TRAFFIC"
    AIRPORT_OPERATIONS = "AIRPORT_OPERATIONS"
    SECURITY = "SECURITY"
    OTHER = "OTHER"

@dataclass
class Airport:
    """Airport information model."""
    code: str
    name: str
    city: str
    country: str
    timezone: str
    coordinates: Dict[str, float]
    weather_station_id: Optional[str] = None

@dataclass
class Aircraft:
    """Aircraft information model."""
    registration: str
    type: str
    model: str
    airline: str
    capacity: int
    year_manufactured: Optional[int] = None

@dataclass
class FlightPosition:
    """Real-time flight position data."""
    latitude: float
    longitude: float
    altitude: float
    heading: float
    ground_speed: float
    vertical_speed: float
    timestamp: datetime
    source: str

@dataclass
class WeatherCondition:
    """Weather condition data."""
    temperature: float
    humidity: float
    pressure: float
    wind_speed: float
    wind_direction: float
    visibility: float
    precipitation: float
    cloud_coverage: float
    conditions: str
    severity: WeatherSeverity
    timestamp: datetime

@dataclass
class DelayPrediction:
    """Delay prediction result."""
    predicted_delay_minutes: float
    confidence: float
    factors: List[str]
    model_version: str
    prediction_timestamp: datetime

class FlightRequest(BaseModel):
    """Flight information request model."""
    flight_number: str = Field(..., description="Flight number (e.g., AA123)")
    date: Optional[str] = Field(None, description="Flight date (YYYY-MM-DD), defaults to today")
    include_position: bool = Field(default=False, description="Include real-time position data")
    include_weather: bool = Field(default=False, description="Include weather impact analysis")
    include_prediction: bool = Field(default=False, description="Include delay predictions")

class FlightSearchRequest(BaseModel):
    """Flight search request model."""
    origin: Optional[str] = Field(None, description="Origin airport code")
    destination: Optional[str] = Field(None, description="Destination airport code")
    airline: Optional[str] = Field(None, description="Airline code")
    date: Optional[str] = Field(None, description="Flight date (YYYY-MM-DD)")
    status: Optional[FlightStatus] = Field(None, description="Flight status filter")
    limit: int = Field(default=50, le=500, description="Maximum results to return")
    include_predictions: bool = Field(default=False, description="Include delay predictions")

class FlightResponse(BaseModel):
    """Comprehensive flight information response."""
    flight_number: str
    airline: str
    aircraft: Optional[Dict[str, Any]] = None
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    scheduled_departure: datetime
    scheduled_arrival: datetime
    actual_departure: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    estimated_departure: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    status: FlightStatus
    departure_gate: Optional[str] = None
    arrival_gate: Optional[str] = None
    departure_terminal: Optional[str] = None
    arrival_terminal: Optional[str] = None
    baggage_claim: Optional[str] = None
    delay_minutes: Optional[int] = None
    delay_category: Optional[DelayCategory] = None
    position: Optional[Dict[str, Any]] = None
    weather_origin: Optional[Dict[str, Any]] = None
    weather_destination: Optional[Dict[str, Any]] = None
    delay_prediction: Optional[Dict[str, Any]] = None
    codeshare_flights: List[str] = Field(default_factory=list)
    last_updated: datetime
    data_sources: List[str] = Field(default_factory=list)
    confidence_score: float

# ================================
# APPLICATION STATE MANAGEMENT
# ================================

class ApplicationState:
    """Centralized application state management."""
    
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.db_pool: Optional[asyncpg.Pool] = None
        self.mongodb: Optional[AsyncIOMotorClient] = None
        self.http_client: Optional[httpx.AsyncClient] = None
        self.mqtt_client: Optional[asyncio_mqtt.Client] = None
        
        # Active tracking
        self.tracked_flights: Dict[str, Dict[str, Any]] = {}
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.vendor_status: Dict[str, bool] = {}
        
        # Machine Learning models
        self.delay_prediction_model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        
        # Background tasks
        self.background_tasks: List[asyncio.Task] = []
        
        # Performance tracking
        self.startup_time = datetime.utcnow()
        self.total_requests = 0
        self.cache_hits = 0
        self.cache_misses = 0

app_state = ApplicationState()

# ================================
# VENDOR INTEGRATIONS
# ================================

class VendorConfig:
    """Configuration for external data vendors."""
    
    VENDORS = {
        "flightaware": {
            "name": "FlightAware",
            "base_url": "https://aeroapi.flightaware.com/aeroapi",
            "rate_limit": 1000,  # requests per hour
            "timeout": 10,
            "priority": 1
        },
        "flightradar24": {
            "name": "FlightRadar24",
            "base_url": "https://api.flightradar24.com",
            "rate_limit": 500,
            "timeout": 10,
            "priority": 2
        },
        "aviationstack": {
            "name": "Aviation Stack",
            "base_url": "http://api.aviationstack.com/v1",
            "rate_limit": 1000,
            "timeout": 10,
            "priority": 3
        },
        "openweather": {
            "name": "OpenWeather",
            "base_url": "https://api.openweathermap.org/data/2.5",
            "rate_limit": 1000,
            "timeout": 5,
            "priority": 1
        }
    }

class FlightDataAggregator:
    """Aggregates flight data from multiple vendors with intelligent failover."""
    
    def __init__(self):
        self.vendor_configs = VendorConfig.VENDORS
        self.rate_limiters: Dict[str, Any] = {}
        self.vendor_health: Dict[str, Dict[str, Any]] = {}
        
    async def get_flight_data(self, flight_number: str, date: str) -> Optional[Dict[str, Any]]:
        """Get flight data with vendor failover."""
        with tracer.start_as_current_span("flight_data_aggregation") as span:
            span.set_attribute("flight_number", flight_number)
            span.set_attribute("date", date)
            
            # Try vendors in priority order
            for vendor_name in sorted(self.vendor_configs.keys(), 
                                    key=lambda x: self.vendor_configs[x]["priority"]):
                
                if not self._is_vendor_healthy(vendor_name):
                    continue
                    
                try:
                    data = await self._fetch_from_vendor(vendor_name, flight_number, date)
                    if data:
                        METRICS["data_requests"].labels(
                            vendor=vendor_name, status="success", type="flight"
                        ).inc()
                        span.set_attribute("successful_vendor", vendor_name)
                        return data
                        
                except Exception as e:
                    logger.warning(f"Vendor {vendor_name} failed: {e}")
                    METRICS["data_requests"].labels(
                        vendor=vendor_name, status="error", type="flight"
                    ).inc()
                    self._mark_vendor_unhealthy(vendor_name, str(e))
                    continue
            
            logger.error(f"All vendors failed for flight {flight_number}")
            return None
    
    async def _fetch_from_vendor(self, vendor: str, flight_number: str, date: str) -> Optional[Dict[str, Any]]:
        """Fetch data from specific vendor."""
        config = self.vendor_configs[vendor]
        
        if vendor == "flightaware":
            return await self._fetch_flightaware(flight_number, date, config)
        elif vendor == "flightradar24":
            return await self._fetch_flightradar24(flight_number, date, config)
        elif vendor == "aviationstack":
            return await self._fetch_aviationstack(flight_number, date, config)
        
        return None
    
    async def _fetch_flightaware(self, flight_number: str, date: str, config: Dict) -> Optional[Dict[str, Any]]:
        """Fetch from FlightAware AeroAPI."""
        if not CONFIG["FLIGHTAWARE_API_KEY"]:
            return None
            
        url = f"{config['base_url']}/flights/{flight_number}"
        headers = {
            "x-apikey": CONFIG["FLIGHTAWARE_API_KEY"],
            "Accept": "application/json"
        }
        
        params = {
            "start": date,
            "end": date
        }
        
        timeout = httpx.Timeout(config["timeout"])
        async with app_state.http_client.get(url, headers=headers, params=params, timeout=timeout) as response:
            if response.status_code == 200:
                data = await response.json()
                return self._normalize_flightaware_data(data)
            
        return None
    
    def _normalize_flightaware_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize FlightAware data to internal format."""
        if not data.get("flights"):
            return {}
            
        flight = data["flights"][0]
        
        return {
            "flight_number": flight.get("ident", ""),
            "airline": flight.get("operator", ""),
            "origin": {
                "code": flight.get("origin", {}).get("code", ""),
                "name": flight.get("origin", {}).get("name", ""),
                "city": flight.get("origin", {}).get("city", ""),
                "timezone": flight.get("origin", {}).get("timezone", "")
            },
            "destination": {
                "code": flight.get("destination", {}).get("code", ""),
                "name": flight.get("destination", {}).get("name", ""),
                "city": flight.get("destination", {}).get("city", ""),
                "timezone": flight.get("destination", {}).get("timezone", "")
            },
            "scheduled_departure": flight.get("scheduled_out"),
            "scheduled_arrival": flight.get("scheduled_in"),
            "actual_departure": flight.get("actual_out"),
            "actual_arrival": flight.get("actual_in"),
            "estimated_departure": flight.get("estimated_out"),
            "estimated_arrival": flight.get("estimated_in"),
            "status": self._map_flightaware_status(flight.get("status", "")),
            "departure_gate": flight.get("gate_origin"),
            "arrival_gate": flight.get("gate_destination"),
            "aircraft_type": flight.get("aircraft_type"),
            "source": "flightaware",
            "last_updated": datetime.utcnow().isoformat()
        }
    
    def _map_flightaware_status(self, status: str) -> FlightStatus:
        """Map FlightAware status to internal status."""
        status_mapping = {
            "Scheduled": FlightStatus.SCHEDULED,
            "Active": FlightStatus.IN_AIR,
            "Completed": FlightStatus.ARRIVED,
            "Cancelled": FlightStatus.CANCELLED,
            "Diverted": FlightStatus.DIVERTED
        }
        return status_mapping.get(status, FlightStatus.UNKNOWN)
    
    def _is_vendor_healthy(self, vendor: str) -> bool:
        """Check if vendor is currently healthy."""
        health = self.vendor_health.get(vendor, {})
        if not health:
            return True  # Assume healthy if no data
            
        last_failure = health.get("last_failure")
        if not last_failure:
            return True
            
        # Consider vendor healthy after 5 minutes
        recovery_time = timedelta(minutes=5)
        return datetime.utcnow() - last_failure > recovery_time
    
    def _mark_vendor_unhealthy(self, vendor: str, error: str):
        """Mark vendor as unhealthy."""
        self.vendor_health[vendor] = {
            "last_failure": datetime.utcnow(),
            "error": error,
            "failure_count": self.vendor_health.get(vendor, {}).get("failure_count", 0) + 1
        }
        
        METRICS["vendor_availability"].labels(vendor=vendor).set(0)

# ================================
# MACHINE LEARNING & PREDICTIONS
# ================================

class DelayPredictor:
    """Machine learning-based delay prediction service."""
    
    def __init__(self):
        self.model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.feature_columns = [
            "hour_of_day", "day_of_week", "month", "distance",
            "historical_delay_avg", "weather_score", "airport_load",
            "airline_punctuality", "aircraft_age", "route_frequency"
        ]
        
    async def initialize_model(self):
        """Initialize or load the delay prediction model."""
        try:
            # Try loading existing model
            self.model = joblib.load("models/delay_prediction_model.pkl")
            self.scaler = joblib.load("models/delay_prediction_scaler.pkl")
            logger.info("Loaded existing delay prediction model")
            
        except FileNotFoundError:
            # Train new model with historical data
            await self._train_new_model()
            
    async def _train_new_model(self):
        """Train a new delay prediction model."""
        logger.info("Training new delay prediction model...")
        
        # Get historical flight data
        historical_data = await self._get_historical_training_data()
        
        if len(historical_data) < 1000:
            logger.warning("Insufficient training data, using dummy model")
            self.model = RandomForestRegressor(n_estimators=10, random_state=42)
            self.scaler = StandardScaler()
            
            # Create dummy training data
            X_dummy = np.random.rand(100, len(self.feature_columns))
            y_dummy = np.random.rand(100) * 60  # Random delays 0-60 minutes
            
            X_scaled = self.scaler.fit_transform(X_dummy)
            self.model.fit(X_scaled, y_dummy)
            
        else:
            # Train with real data
            X, y = self._prepare_training_data(historical_data)
            
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)
            
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=20,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42
            )
            
            self.model.fit(X_scaled, y)
            
            # Save model
            os.makedirs("models", exist_ok=True)
            joblib.dump(self.model, "models/delay_prediction_model.pkl")
            joblib.dump(self.scaler, "models/delay_prediction_scaler.pkl")
            
        logger.info("Delay prediction model ready")
    
    async def predict_delay(self, flight_data: Dict[str, Any]) -> DelayPrediction:
        """Predict delay for a specific flight."""
        if not self.model or not self.scaler:
            await self.initialize_model()
        
        try:
            # Extract features
            features = await self._extract_features(flight_data)
            
            # Make prediction
            features_scaled = self.scaler.transform([features])
            predicted_delay = self.model.predict(features_scaled)[0]
            
            # Calculate confidence (simplified)
            feature_importance = self.model.feature_importances_
            confidence = min(0.95, np.mean(feature_importance) * 2)
            
            # Identify contributing factors
            factors = self._identify_delay_factors(features, feature_importance)
            
            prediction = DelayPrediction(
                predicted_delay_minutes=max(0, predicted_delay),
                confidence=confidence,
                factors=factors,
                model_version="1.0",
                prediction_timestamp=datetime.utcnow()
            )
            
            # Update metrics
            accuracy_tier = "high" if confidence > 0.8 else "medium" if confidence > 0.6 else "low"
            METRICS["delay_predictions"].labels(accuracy_tier=accuracy_tier).inc()
            
            return prediction
            
        except Exception as e:
            logger.error(f"Delay prediction failed: {e}")
            return DelayPrediction(
                predicted_delay_minutes=0,
                confidence=0,
                factors=["prediction_error"],
                model_version="1.0",
                prediction_timestamp=datetime.utcnow()
            )
    
    async def _extract_features(self, flight_data: Dict[str, Any]) -> List[float]:
        """Extract features for delay prediction."""
        departure_time = datetime.fromisoformat(flight_data.get("scheduled_departure", ""))
        
        features = [
            departure_time.hour,  # hour_of_day
            departure_time.weekday(),  # day_of_week
            departure_time.month,  # month
            flight_data.get("distance", 1000),  # distance
            await self._get_historical_delay_avg(flight_data.get("flight_number", "")),
            await self._get_weather_score(flight_data),
            await self._get_airport_load(flight_data.get("origin", {})),
            await self._get_airline_punctuality(flight_data.get("airline", "")),
            flight_data.get("aircraft_age", 10),  # aircraft_age
            await self._get_route_frequency(flight_data)
        ]
        
        return features
    
    async def _get_historical_delay_avg(self, flight_number: str) -> float:
        """Get historical average delay for flight number."""
        # Simplified implementation
        return 15.0  # 15 minutes average
    
    async def _get_weather_score(self, flight_data: Dict[str, Any]) -> float:
        """Calculate weather impact score (0-100)."""
        # Simplified implementation
        return 20.0  # Low weather impact
    
    async def _get_airport_load(self, airport: Dict[str, Any]) -> float:
        """Get current airport traffic load."""
        # Simplified implementation
        return 50.0  # Medium load
    
    async def _get_airline_punctuality(self, airline: str) -> float:
        """Get airline historical punctuality score."""
        # Simplified implementation
        return 85.0  # 85% on-time
    
    async def _get_route_frequency(self, flight_data: Dict[str, Any]) -> float:
        """Get route frequency (flights per day)."""
        # Simplified implementation
        return 5.0  # 5 flights per day
    
    def _identify_delay_factors(self, features: List[float], importance: List[float]) -> List[str]:
        """Identify main factors contributing to delay prediction."""
        factor_names = [
            "Time of Day", "Day of Week", "Season", "Distance",
            "Historical Performance", "Weather", "Airport Traffic",
            "Airline Performance", "Aircraft Age", "Route Popularity"
        ]
        
        # Get top 3 factors
        top_indices = np.argsort(importance)[-3:]
        return [factor_names[i] for i in reversed(top_indices)]

# ================================
# WEATHER INTEGRATION
# ================================

class WeatherService:
    """Weather data integration for flight impact analysis."""
    
    def __init__(self):
        self.weather_cache: Dict[str, Dict[str, Any]] = {}
        
    async def get_airport_weather(self, airport_code: str) -> Optional[WeatherCondition]:
        """Get current weather conditions for airport."""
        if not CONFIG["ENABLE_WEATHER_INTEGRATION"] or not CONFIG["WEATHER_API_KEY"]:
            return None
            
        try:
            # Check cache first
            cache_key = f"weather:{airport_code}"
            cached = await app_state.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return WeatherCondition(**data)
            
            # Fetch from weather API
            url = f"{VendorConfig.VENDORS['openweather']['base_url']}/weather"
            params = {
                "q": airport_code,
                "appid": CONFIG["WEATHER_API_KEY"],
                "units": "metric"
            }
            
            async with app_state.http_client.get(url, params=params) as response:
                if response.status_code == 200:
                    data = await response.json()
                    weather = self._parse_weather_data(data)
                    
                    # Cache for 10 minutes
                    await app_state.redis.setex(
                        cache_key, 600, json.dumps(weather.__dict__, default=str)
                    )
                    
                    return weather
                    
        except Exception as e:
            logger.error(f"Weather data fetch failed for {airport_code}: {e}")
            
        return None
    
    def _parse_weather_data(self, data: Dict[str, Any]) -> WeatherCondition:
        """Parse weather API response."""
        main = data.get("main", {})
        wind = data.get("wind", {})
        
        # Calculate severity based on conditions
        visibility = data.get("visibility", 10000) / 1000  # Convert to km
        wind_speed = wind.get("speed", 0)
        conditions = data.get("weather", [{}])[0].get("main", "Clear")
        
        severity = WeatherSeverity.LOW
        if wind_speed > 15 or visibility < 5 or conditions in ["Thunderstorm", "Snow"]:
            severity = WeatherSeverity.HIGH
        elif wind_speed > 10 or visibility < 8 or conditions in ["Rain", "Fog"]:
            severity = WeatherSeverity.MODERATE
        
        return WeatherCondition(
            temperature=main.get("temp", 20),
            humidity=main.get("humidity", 50),
            pressure=main.get("pressure", 1013),
            wind_speed=wind_speed,
            wind_direction=wind.get("deg", 0),
            visibility=visibility,
            precipitation=data.get("rain", {}).get("1h", 0),
            cloud_coverage=data.get("clouds", {}).get("all", 0),
            conditions=conditions,
            severity=severity,
            timestamp=datetime.utcnow()
        )
    
    async def analyze_weather_impact(self, flight_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze weather impact on flight operations."""
        origin_weather = await self.get_airport_weather(flight_data.get("origin", {}).get("code", ""))
        dest_weather = await self.get_airport_weather(flight_data.get("destination", {}).get("code", ""))
        
        impact_score = 0
        impacting_factors = []
        
        for weather, location in [(origin_weather, "origin"), (dest_weather, "destination")]:
            if weather:
                if weather.severity in [WeatherSeverity.HIGH, WeatherSeverity.SEVERE]:
                    impact_score += 30
                    impacting_factors.append(f"{location}_severe_weather")
                elif weather.severity == WeatherSeverity.MODERATE:
                    impact_score += 10
                    impacting_factors.append(f"{location}_moderate_weather")
                
                if weather.wind_speed > 20:
                    impact_score += 15
                    impacting_factors.append(f"{location}_high_winds")
                
                if weather.visibility < 3:
                    impact_score += 25
                    impacting_factors.append(f"{location}_low_visibility")
        
        risk_level = "LOW"
        if impact_score > 40:
            risk_level = "HIGH"
        elif impact_score > 20:
            risk_level = "MODERATE"
        
        return {
            "impact_score": min(100, impact_score),
            "risk_level": risk_level,
            "impacting_factors": impacting_factors,
            "origin_weather": origin_weather.__dict__ if origin_weather else None,
            "destination_weather": dest_weather.__dict__ if dest_weather else None
        }

# ================================
# CORE FLIGHT SERVICE
# ================================

class FlightService:
    """Core flight information service with comprehensive data management."""
    
    def __init__(self):
        self.data_aggregator = FlightDataAggregator()
        self.delay_predictor = DelayPredictor()
        self.weather_service = WeatherService()
        
    async def initialize(self):
        """Initialize the flight service."""
        if CONFIG["ENABLE_ML_PREDICTIONS"]:
            await self.delay_predictor.initialize_model()
            
    async def get_flight_info(self, flight_number: str, date: str = None, 
                            include_position: bool = False,
                            include_weather: bool = False,
                            include_prediction: bool = False) -> Optional[FlightResponse]:
        """Get comprehensive flight information."""
        with tracer.start_as_current_span("get_flight_info") as span:
            start_time = time.time()
            
            if not date:
                date = datetime.utcnow().strftime("%Y-%m-%d")
            
            span.set_attribute("flight_number", flight_number)
            span.set_attribute("date", date)
            
            try:
                # Check cache first
                cache_key = f"flight:{flight_number}:{date}"
                cached_data = await app_state.redis.get(cache_key)
                
                if cached_data:
                    app_state.cache_hits += 1
                    METRICS["cache_hit_ratio"].set(
                        app_state.cache_hits / (app_state.cache_hits + app_state.cache_misses)
                    )
                    
                    flight_data = json.loads(cached_data)
                else:
                    app_state.cache_misses += 1
                    
                    # Fetch from aggregator
                    flight_data = await self.data_aggregator.get_flight_data(flight_number, date)
                    if not flight_data:
                        return None
                    
                    # Enhance with additional data
                    await self._enhance_flight_data(flight_data)
                    
                    # Cache for configured TTL
                    await app_state.redis.setex(
                        cache_key, CONFIG["CACHE_TTL_SECONDS"], 
                        json.dumps(flight_data, default=str)
                    )
                
                # Add optional enhancements
                if include_position:
                    flight_data["position"] = await self._get_flight_position(flight_number)
                
                if include_weather and CONFIG["ENABLE_WEATHER_INTEGRATION"]:
                    weather_analysis = await self.weather_service.analyze_weather_impact(flight_data)
                    flight_data.update(weather_analysis)
                
                if include_prediction and CONFIG["ENABLE_ML_PREDICTIONS"]:
                    prediction = await self.delay_predictor.predict_delay(flight_data)
                    flight_data["delay_prediction"] = prediction.__dict__
                
                # Calculate confidence score
                flight_data["confidence_score"] = self._calculate_confidence_score(flight_data)
                
                # Update metrics
                processing_time = time.time() - start_time
                METRICS["response_time"].labels(
                    endpoint="get_flight_info", vendor="aggregated"
                ).observe(processing_time)
                
                # Convert to response model
                return FlightResponse(**flight_data)
                
            except Exception as e:
                span.record_exception(e)
                logger.error(f"Error getting flight info for {flight_number}: {e}")
                return None
    
    async def search_flights(self, search_params: FlightSearchRequest) -> List[FlightResponse]:
        """Search flights based on multiple criteria."""
        with tracer.start_as_current_span("search_flights") as span:
            try:
                # Build database query
                query_conditions = []
                query_params = []
                
                if search_params.origin:
                    query_conditions.append("origin_code = $" + str(len(query_params) + 1))
                    query_params.append(search_params.origin.upper())
                
                if search_params.destination:
                    query_conditions.append("destination_code = $" + str(len(query_params) + 1))
                    query_params.append(search_params.destination.upper())
                
                if search_params.airline:
                    query_conditions.append("airline = $" + str(len(query_params) + 1))
                    query_params.append(search_params.airline.upper())
                
                if search_params.date:
                    query_conditions.append("DATE(scheduled_departure) = $" + str(len(query_params) + 1))
                    query_params.append(search_params.date)
                else:
                    # Default to today
                    query_conditions.append("DATE(scheduled_departure) = $" + str(len(query_params) + 1))
                    query_params.append(datetime.utcnow().strftime("%Y-%m-%d"))
                
                if search_params.status:
                    query_conditions.append("status = $" + str(len(query_params) + 1))
                    query_params.append(search_params.status.value)
                
                # Build final query
                where_clause = " AND ".join(query_conditions) if query_conditions else "1=1"
                query = f"""
                    SELECT * FROM flights 
                    WHERE {where_clause}
                    ORDER BY scheduled_departure
                    LIMIT ${ len(query_params) + 1}
                """
                query_params.append(search_params.limit)
                
                # Execute query
                async with app_state.db_pool.acquire() as conn:
                    rows = await conn.fetch(query, *query_params)
                
                # Convert to response objects
                flights = []
                for row in rows:
                    flight_data = dict(row)
                    
                    # Add predictions if requested
                    if search_params.include_predictions and CONFIG["ENABLE_ML_PREDICTIONS"]:
                        prediction = await self.delay_predictor.predict_delay(flight_data)
                        flight_data["delay_prediction"] = prediction.__dict__
                    
                    flight_data["confidence_score"] = self._calculate_confidence_score(flight_data)
                    flights.append(FlightResponse(**flight_data))
                
                span.set_attribute("results_count", len(flights))
                return flights
                
            except Exception as e:
                span.record_exception(e)
                logger.error(f"Error searching flights: {e}")
                return []
    
    async def _enhance_flight_data(self, flight_data: Dict[str, Any]):
        """Enhance flight data with additional information."""
        # Store in database for future queries
        await self._store_flight_data(flight_data)
        
        # Add calculated fields
        if flight_data.get("actual_departure") and flight_data.get("scheduled_departure"):
            scheduled = datetime.fromisoformat(flight_data["scheduled_departure"])
            actual = datetime.fromisoformat(flight_data["actual_departure"])
            delay = (actual - scheduled).total_seconds() / 60
            flight_data["delay_minutes"] = int(delay) if delay > 0 else 0
        
        # Add data freshness
        flight_data["last_updated"] = datetime.utcnow().isoformat()
        flight_data["data_sources"] = ["aggregated"]
    
    async def _store_flight_data(self, flight_data: Dict[str, Any]):
        """Store flight data in database."""
        try:
            async with app_state.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO flights (
                        flight_number, airline, origin_code, destination_code,
                        scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
                        estimated_departure, estimated_arrival, status, departure_gate, arrival_gate,
                        aircraft_type, last_updated, data_source
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (flight_number, scheduled_departure) 
                    DO UPDATE SET
                        actual_departure = EXCLUDED.actual_departure,
                        actual_arrival = EXCLUDED.actual_arrival,
                        estimated_departure = EXCLUDED.estimated_departure,
                        estimated_arrival = EXCLUDED.estimated_arrival,
                        status = EXCLUDED.status,
                        departure_gate = EXCLUDED.departure_gate,
                        arrival_gate = EXCLUDED.arrival_gate,
                        last_updated = EXCLUDED.last_updated
                """, 
                    flight_data.get("flight_number", ""),
                    flight_data.get("airline", ""),
                    flight_data.get("origin", {}).get("code", ""),
                    flight_data.get("destination", {}).get("code", ""),
                    flight_data.get("scheduled_departure"),
                    flight_data.get("scheduled_arrival"),
                    flight_data.get("actual_departure"),
                    flight_data.get("actual_arrival"),
                    flight_data.get("estimated_departure"),
                    flight_data.get("estimated_arrival"),
                    flight_data.get("status", "UNKNOWN"),
                    flight_data.get("departure_gate"),
                    flight_data.get("arrival_gate"),
                    flight_data.get("aircraft_type"),
                    datetime.utcnow(),
                    flight_data.get("source", "unknown")
                )
        except Exception as e:
            logger.error(f"Error storing flight data: {e}")
    
    async def _get_flight_position(self, flight_number: str) -> Optional[Dict[str, Any]]:
        """Get real-time flight position."""
        # This would integrate with flight tracking APIs
        # Simplified implementation for demo
        return {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "altitude": 35000,
            "heading": 90,
            "ground_speed": 500,
            "vertical_speed": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "simulated"
        }
    
    def _calculate_confidence_score(self, flight_data: Dict[str, Any]) -> float:
        """Calculate data confidence score based on sources and recency."""
        score = 0.5  # Base score
        
        # Data source quality
        if flight_data.get("source") == "flightaware":
            score += 0.3
        elif flight_data.get("source") == "flightradar24":
            score += 0.25
        else:
            score += 0.15
        
        # Data recency
        last_updated = flight_data.get("last_updated")
        if last_updated:
            try:
                update_time = datetime.fromisoformat(last_updated)
                age_minutes = (datetime.utcnow() - update_time).total_seconds() / 60
                
                if age_minutes < 5:
                    score += 0.2
                elif age_minutes < 15:
                    score += 0.1
                elif age_minutes > 60:
                    score -= 0.1
            except:
                pass
        
        return min(1.0, max(0.0, score))

# Continue with remaining implementation... 