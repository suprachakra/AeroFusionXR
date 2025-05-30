from fastapi import FastAPI
from routers.feature_router import router as feature_router
from utils.logger import setup_logging

setup_logging()
app = FastAPI(title="Feature Store", version="1.0.0")

@app.on_event("startup")
async def startup():
    # e.g. create DB pool, warm cache
    pass

app.include_router(feature_router, prefix="/features", tags=["features"])

@app.get("/health")
async def health():
    return {"status": "ok"}
