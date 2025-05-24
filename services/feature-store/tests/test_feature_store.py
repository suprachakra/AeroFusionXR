from fastapi.testclient import TestClient
from app import app
client = TestClient(app)
def test_health(): assert client.get('/health').status_code==200
