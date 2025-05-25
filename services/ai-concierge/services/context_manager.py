from typing import Optional

class ContextManager:
    def __init__(self):
        self.store = {}

    def load(self, session_id: Optional[str]) -> dict:
        return self.store.get(session_id, {})

    def save(self, session_id: str, context: dict):
        self.store[session_id] = context
