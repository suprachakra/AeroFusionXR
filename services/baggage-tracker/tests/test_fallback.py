from fallback.qr_fallback import scan_qr

def test_qr():
    assert scan_qr('tests/sample_qr.png') in [None, str]
