import json

def parse_beacon(beacon_payload):
    return json.loads(beacon_payload)
