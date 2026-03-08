#!/usr/bin/env python3
"""
OCR service using OpenCV for image preprocessing + pytesseract for text extraction.
Usage: python ocr.py <image_path>
Output: JSON { "text": "...", "confidence": 0.0-100.0 }
"""
import sys
import json
import os

def preprocess_and_ocr(image_path):
    try:
        import cv2
        import numpy as np
        import pytesseract
        import shutil
        tess = shutil.which('tesseract') or '/opt/homebrew/bin/tesseract'
        pytesseract.pytesseract.tesseract_cmd = tess
    except ImportError as e:
        return {"text": "", "confidence": 0, "error": f"Missing dependency: {e}"}

    if not os.path.exists(image_path):
        return {"text": "", "confidence": 0, "error": f"File not found: {image_path}"}

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        return {"text": "", "confidence": 0, "error": "Could not read image"}

    # --- OpenCV Preprocessing Pipeline ---
    # 1. Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2. Upscale if small (improves OCR accuracy)
    h, w = gray.shape
    if w < 1000:
        scale = 1000 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # 3. Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # 4. Adaptive thresholding for better binarization (handles uneven lighting)
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11, 2
    )

    # 5. Deskew - detect and correct rotation
    coords = np.column_stack(np.where(thresh < 127))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > 0.5:
            (h2, w2) = thresh.shape
            center = (w2 // 2, h2 // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            thresh = cv2.warpAffine(thresh, M, (w2, h2),
                                    flags=cv2.INTER_CUBIC,
                                    borderMode=cv2.BORDER_REPLICATE)

    # 6. Morphological operations to clean up noise
    kernel = np.ones((1, 1), np.uint8)
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    # --- pytesseract OCR ---
    custom_config = r'--oem 3 --psm 6'
    data = pytesseract.image_to_data(
        cleaned,
        config=custom_config,
        output_type=pytesseract.Output.DICT
    )

    # Extract text and average confidence (ignore -1 conf values)
    words = []
    confidences = []
    for i, word in enumerate(data['text']):
        word = word.strip()
        if word:
            words.append(word)
            conf = data['conf'][i]
            if conf != -1:
                confidences.append(conf)

    text = pytesseract.image_to_string(cleaned, config=custom_config)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    return {
        "text": text.strip(),
        "confidence": round(avg_confidence, 2),
        "word_count": len(words)
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ocr.py <image_path>"}))
        sys.exit(1)

    result = preprocess_and_ocr(sys.argv[1])
    print(json.dumps(result))
