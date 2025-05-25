from cv.pipeline import detect_baggage
from fallback.qr_fallback import scan_qr

def compute_eta(request):
    frame = request.get('frame_path')
    detections = detect_baggage(frame)
    if not detections:
        code = scan_qr(request.get('qr_image'))
        return {'eta': f'QR {code} fallback ETA'}
    return {'eta': '45s'}
