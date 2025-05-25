import numpy as np

def filter_by_depth(detections, depth_map):
    return [d for d in detections if depth_map[d['box'][1]][d['box'][0]] < 5]
