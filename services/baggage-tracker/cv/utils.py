import cv2

def preprocess(frame_path):
    img = cv2.imread(frame_path)
    return cv2.resize(img, (640, 640))  
