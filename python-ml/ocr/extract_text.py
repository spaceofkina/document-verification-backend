# python-ml/ocr/extract_text.py
import pytesseract
import cv2
import re
import os

# Set Tesseract path for Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class PhilippineOCR:
    def __init__(self):
        self.languages = 'eng+fil'  # English + Filipino
        
    def extract_text(self, image_path):
        """Extract text from Philippine document"""
        try:
            print(f"🔍 Extracting text from Philippine document...")
            
            # Read and preprocess
            img = cv2.imread(image_path)
            if img is None:
                return {'text': '', 'confidence': 0, 'error': 'Could not read image'}
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply thresholding
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Perform OCR
            text = pytesseract.image_to_string(thresh, lang=self.languages)
            
            # Get confidence
            data = pytesseract.image_to_data(thresh, lang=self.languages, 
                                           output_type=pytesseract.Output.DICT)
            
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return {
                'text': text,
                'confidence': avg_confidence,
                'success': True,
                'note': 'Philippine Document OCR Complete'
            }
            
        except Exception as e:
            return {
                'text': '',
                'confidence': 0,
                'error': str(e),
                'success': False
            }
    
    def extract_name(self, text):
        """Extract Philippine name from text"""
        name_patterns = [
            r'name[:\s]+([a-z]+(?:\s+[a-z]+)+)',
            r'full name[:\s]+([a-z]+(?:\s+[a-z]+)+)',
            r'pangalan[:\s]+([a-z]+(?:\s+[a-z]+)+)'
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1)
                return ' '.join(word.capitalize() for word in name.split())
        
        return None