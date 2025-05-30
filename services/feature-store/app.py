from fastapi import FastAPI
from routers.feature_router import router as feature_router

app = FastAPI(title="Feature Store Service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(feature_router, prefix="/features", tags=["features"])
