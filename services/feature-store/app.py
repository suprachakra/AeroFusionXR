from fastapi import FastAPI
from routers.feature_router import router
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Feature Store", version="1.0.0")
app.include_router(router, prefix="/features")

@app.get("/health")
def health(): return {"status":"ok"}
