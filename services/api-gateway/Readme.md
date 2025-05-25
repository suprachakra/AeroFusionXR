## API Gateway

### Purpose
Acts as the unified ingress for all microservice APIs, providing authentication, rate limiting, request tracing, and API documentation.

### Features
- **JWT Authentication** with Cognito
- **Rate Limiting** per client ID
- **Circuit Breaker** & Retry patterns
- **Distributed Tracing** with OpenTelemetry
- **API Documentation** via OpenAPI (Swagger)
- **Health Checks** and readiness probes

### Structure
```
api-gateway/
├── src/
│   ├── index.js             # Express app setup
│   ├── routes/              # Route definitions
│   ├── controllers/         # Request handlers
│   ├── middlewares/         # Rate limiter, auth, error handling
│   ├── services/            # JWT, tracing, circuit breaker
│   └── utils/               # Logger, config loader
├── openapi.yaml             # API spec for routes
├── tests/                   # Jest & Supertest suites
├── package.json             # Node dependencies & scripts
├── Dockerfile               # Multi-stage container build
└── Readme.md                # This file

````

### Getting Started
```bash
npm install
npm run test
npm run lint
npm start
````

### Endpoints

* `POST /auth/login`
* `GET /health`
* Routes proxied: `/booking`, `/flight-info`, etc.

### Configuration

* Environment variables via `.env`
* Rate limits, JWT secrets loaded from AWS Secrets Manager

````
