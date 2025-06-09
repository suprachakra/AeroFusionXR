# Flight Info Service

Real-time flight status and schedule service for AeroFusion XR, built with FastAPI and Python.

## Features

### Core Features

- **Flight Status Queries**
  - Single/multi-flight lookup by number, date, route
  - Real-time vendor aggregation + consistency check
  - Caching layer with TTL and manual invalidation
  - Historical flight data access

- **Schedule & Connection Planning**
  - Multi-leg itineraries and "gap analysis" for layovers
  - Calendar integration (iCal/Google) export
  - Alert subscription on schedule changes
  - Real-time schedule updates

- **Webhook & Push Callbacks**
  - Subscriber registration API
  - Retry-safe webhook dispatcher with DLQ
  - Parallel vendor fallbacks for high availability
  - HMAC signature verification

- **Fallback & Degradation Modes**
  - Stale cache read when vendor down
  - "Estimated" status compute based on historical averages
  - Graceful user messaging ("Data delayed by 2 m")
  - Automatic vendor failover

### Technical Features

- **Performance & Scalability**
  - Redis-based caching
  - MongoDB for flight data
  - Horizontal scaling support
  - Rate limiting & throttling

- **Monitoring & Observability**
  - OpenTelemetry integration
  - Prometheus metrics
  - Structured logging
  - Health checks

- **Security & Compliance**
  - PII redaction
  - Data residency controls
  - Audit logging
  - Rate limiting

## Getting Started

### Prerequisites

- Python 3.11+
- Poetry
- MongoDB 7.x
- Redis 7.x
- Docker (optional)
- Kubernetes (optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aerofusion/aerofusion-xr.git
   cd services/flight-info
   ```

2. Install dependencies:
   ```bash
   poetry install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the service:
   ```bash
   poetry run uvicorn flight_info.main:app --reload
   ```

### Docker

Build and run with Docker:

```bash
docker build -t aerofusion/flight-info .
docker run -p 8000:8000 aerofusion/flight-info
```

### Kubernetes

Deploy to Kubernetes:

```bash
kubectl apply -f k8s/
```

## API Documentation

### Flight Status

```http
GET /api/flights/{flight_number}
```

Response:
```json
{
  "flight_number": "AF123",
  "airline": "Air France",
  "status": "IN_AIR",
  "origin": {
    "code": "CDG",
    "name": "Charles de Gaulle Airport"
  },
  "destination": {
    "code": "JFK",
    "name": "John F. Kennedy International Airport"
  },
  "scheduled_departure": "2024-02-24T10:00:00Z",
  "scheduled_arrival": "2024-02-24T22:00:00Z",
  "position": {
    "latitude": 45.0000,
    "longitude": -40.0000,
    "altitude": 35000
  }
}
```

### Flight Search

```http
GET /api/flights?origin=CDG&destination=JFK
```

Response:
```json
{
  "flights": [
    {
      "flight_number": "AF123",
      "airline": "Air France",
      "status": "SCHEDULED"
    }
  ]
}
```

### Webhook Subscriptions

```http
POST /api/subscriptions
Content-Type: application/json

{
  "flight_numbers": ["AF123"],
  "callback_url": "https://api.example.com/webhooks",
  "events": ["STATUS_CHANGE", "DELAY"],
  "secret": "your_webhook_secret"
}
```

Response:
```json
{
  "id": "sub_123456",
  "status": "ACTIVE",
  "created_at": "2024-02-24T12:00:00Z"
}
```

## Architecture

### **Flight Info Service Architecture**

```mermaid
graph TB
    subgraph "Client Applications"
        A[Mobile Apps<br/>Passenger Interface]
        B[Web Dashboard<br/>Staff Portal]
        C[Airport Displays<br/>Flight Boards]
        D[Third-party APIs<br/>Travel Apps]
    end
    
    subgraph "Flight Info Service"
        E[API Gateway<br/>FastAPI]
        F[Flight Tracker<br/>Status Management]
        G[Webhook Dispatcher<br/>Notifications]
        H[Cache Manager<br/>Redis Layer]
        I[Vendor Aggregator<br/>Data Fusion]
    end
    
    subgraph "External Data Sources"
        J[Airline APIs<br/>Real-time Data]
        K[Airport Systems<br/>FIDS Integration]
        L[Flight Radar<br/>Position Data]
        M[Weather APIs<br/>Delay Factors]
    end
    
    subgraph "Data Storage"
        N[(MongoDB<br/>Flight Data)]
        O[(Redis<br/>Cache Layer)]
        P[(Analytics DB<br/>Historical Data)]
        Q[Message Queue<br/>Webhook Events]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    E --> G
    E --> H
    E --> I
    
    I --> J
    I --> K
    I --> L
    I --> M
    
    F --> N
    H --> O
    F --> P
    G --> Q
```

### **Real-time Flight Tracking Flow**

```mermaid
sequenceDiagram
    participant C as Client
    participant F as Flight Service
    participant R as Redis Cache
    participant V as Vendor APIs
    participant W as Webhook System
    participant S as Subscribers
    
    C->>F: GET /api/flights/AF123
    F->>R: Check cache
    
    alt Cache Hit
        R-->>F: Cached flight data
        F-->>C: Return flight status
    else Cache Miss
        F->>V: Query vendor APIs
        V-->>F: Flight data
        F->>R: Update cache
        F->>F: Store in database
        F-->>C: Return flight status
        
        Note over F,W: Check for status changes
        F->>W: Status change detected
        W->>S: Notify subscribers
    end
    
    Note over F,V: Background sync process
    loop Every 30 seconds
        F->>V: Sync all tracked flights
        V-->>F: Updated flight data
        F->>R: Update cache
        F->>W: Trigger notifications
    end
```

### **Vendor Failover & Fallback Strategy**

```mermaid
flowchart TD
    A[Flight Data Request] --> B[Primary Vendor<br/>Airline API]
    
    B --> C{Response OK?}
    
    C -->|Success| D[Return Fresh Data]
    C -->|Timeout/Error| E[Try Secondary Vendor<br/>Airport FIDS]
    
    E --> F{Response OK?}
    
    F -->|Success| G[Return Backup Data]
    F -->|Timeout/Error| H[Try Tertiary Vendor<br/>Flight Radar]
    
    H --> I{Response OK?}
    
    I -->|Success| J[Return Radar Data]
    I -->|All Failed| K[Check Cache<br/>Stale Data]
    
    K --> L{Cache Available?}
    
    L -->|Yes| M[Return Stale Data<br/>+ Warning]
    L -->|No| N[Return Estimated Status<br/>Based on Schedule]
    
    D --> O[Update Cache & DB]
    G --> O
    J --> O
    M --> P[Log Degraded Service]
    N --> P
    
    O --> Q[Notify Subscribers]
    P --> Q
```

### Components

- **Flight Tracker**: Manages real-time flight status tracking
- **Webhook Dispatcher**: Handles subscription management and notifications
- **Cache Manager**: Coordinates Redis caching layer
- **Vendor Clients**: Integrates with external flight data providers

## Development

### Code Style

We use:
- Black for code formatting
- Ruff for linting
- MyPy for type checking

Run all checks:

```bash
poetry run black .
poetry run ruff check .
poetry run mypy .
```

### Testing

Run tests:

```bash
poetry run pytest
```

With coverage:

```bash
poetry run pytest --cov=flight_info
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and linting
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 