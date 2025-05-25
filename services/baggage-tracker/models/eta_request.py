from pydantic import BaseModel

class ETARequest(BaseModel):
    frame_path: str
    qr_image: str
