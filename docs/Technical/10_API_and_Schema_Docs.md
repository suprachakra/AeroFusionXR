### Summary
Robust OpenAPI 3.1+ GraphQL + Protobuf specs for all interfaces, with semantic versioning, changelogs, compatibility guarantees, and schema linting in CI.

### 1. API Types

| Protocol       | Description                                         | Version Control     |
| -------------- | --------------------------------------------------- | ------------------- |
| REST (OpenAPI) | External-facing endpoints (e.g. concierge, booking) | Git versioned specs |
| GraphQL        | Admin & mobile clients (dashboards, wayfinding)     | Schemalint + Git    |
| gRPC/Protobuf  | Microservice-to-service (CV pipeline, LLM agent)    | Buf schema repo     |

### 2. Example Endpoints

| Endpoint                 | Method | Description                   |
| ------------------------ | ------ | ----------------------------- |
| `/api/v1/flight/status`  | GET    | Query flight status           |
| `/api/v1/loyalty/redeem` | POST   | Redeem loyalty points         |
| `/graphql`               | POST   | Unified schema for AR modules |

### 3. Schema Rules

* All API fields **typed, described, and versioned**
* No breaking changes allowed in minor versions
* Required fields never removed without major bump

### 4. Developer Portal (Feature Ready)

* Swagger UI for REST
* GraphiQL for GraphQL
* SDK downloadables + Postman collection
* API usage analytics (rate, errors, latency)
