from pydantic import BaseModel

class QueryResponse(BaseModel):
    reply: str
    confidence: float
