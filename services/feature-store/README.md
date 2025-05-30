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
