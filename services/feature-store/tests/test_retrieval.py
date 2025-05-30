import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_get_missing():
    resp = client.get("/features/unknown")
    assert resp.status_code == 404
