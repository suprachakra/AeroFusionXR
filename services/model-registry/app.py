from fastapi import FastAPI
from services.registry_service import register_model, get_models
import logging

logging.basicConfig(level=logging.INFO)
app=FastAPI(title="Model Registry", version="1.0.0")

@app.post("/models")
def post_model(meta: dict): return register_model(meta)

@app.get("/models")
def list_models(): return get_models()

@app.get("/health")
def health(): return {"status":"ok"}
