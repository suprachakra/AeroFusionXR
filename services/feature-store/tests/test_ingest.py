import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_ingest_success():
    payload = {"id": "f1", "name": "speed", "description": "train speed feature"}
    resp = client.post("/features/ingest", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ingested"
