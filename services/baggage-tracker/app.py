from fastapi import FastAPI, HTTPException
from cv.pipeline import process_frame
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Baggage Tracker", version="1.0.0")

@app.post("/eta")
def eta(data: dict):
    try:
        return process_frame(data.get("image"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
