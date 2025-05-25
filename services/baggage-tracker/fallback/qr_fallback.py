from pyzbar.pyzbar import decode

def scan_qr(image_path):
    data = decode(image_path)
    return data[0].data.decode() if data else None
