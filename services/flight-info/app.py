import logging
from fastapi import FastAPI, HTTPException
from routers.flight_router import router as flight_router

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Flight Info Service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(flight_router, prefix="/flights")
