from pydantic import BaseModel

class TextQuery(BaseModel):
    session_id: str
    text: str
