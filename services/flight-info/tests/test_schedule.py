from fastapi.testclient import TestClient
from app import app
client = TestClient(app)

def test_schedule():
    resp = client.get("/schedules/?date=2025-06-01")
    assert resp.status_code == 200
