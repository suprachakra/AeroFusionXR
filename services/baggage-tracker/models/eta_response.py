from pydantic import BaseModel

class ETAResponse(BaseModel):
    eta: str
