## Feature Store Service

Provides ingestion and retrieval of feature vectors via Redis and optional Postgres migration tables.

### Endpoints
- `POST /features/ingest`: Ingest a feature JSON payload
- `GET  /features/{id}`: Retrieve feature by ID
- `GET  /health`: Health check

### Setup
1. `docker-compose up -d redis`
2. `uvicorn app:app --reload`

###  # Tests
`pytest --cov`

### Structure
```
feature-store/
├── app.py                     # FastAPI app, routers mounting, startup/shutdown hooks
├── routers/
│   └── feature_router.py      # /features ingest & serve endpoints
├── services/
│   └── feature_service.py     # Core logic: validate, persist, retrieve, cache
├── db/
│   ├── models.py              # SQLAlchemy/Pydantic ORM models
│   └── migrations/
│       ├── 001_initial.sql    # CREATE TABLE features (...)
│       └── 002_add_timestamps.sql
├── utils/
│   ├── logger.py              # Structured JSON logging
│   └── db.py                  # DB session provider, retry/backoff
├── tests/
│   ├── test_ingest.py         # Unit: service.ingest + edge cases
│   └── test_retrieval.py      # Integration: read from test DB
├── requirements.txt           # fastapi, uvicorn, sqlalchemy, alembic, pydantic
└── Dockerfile                 # Multi-stage: lint, test, build, slim runtime
```
