from .utils import decode_image, qr_fallback
import time


def process_frame(image_b64: str) -> dict:
    img = decode_image(image_b64)
    start = time.time()
    # YOLOv8 object detection stub
    # if fails, try qr_fallback
    eta = qr_fallback(img)
    latency = time.time() - start
    return {"eta_seconds": eta, "processing_time": latency}
