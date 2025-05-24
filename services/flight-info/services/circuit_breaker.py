import pybreaker
import requests

circuit = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)

class CircuitBreaker:
    @staticmethod
    @circuit
    def call_external(flight_number: str) -> str:
        resp = requests.get(f"https://api.flight.com/status/{flight_number}")
        resp.raise_for_status()
        return resp.json().get("status")
