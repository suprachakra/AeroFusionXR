from fastapi import FastAPI, HTTPException
from pipelines.langchain_pipeline import pipeline
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="AI Concierge", version="1.0.0")

@app.post("/query")
def query(payload: dict):
    try:
        return pipeline.process(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
