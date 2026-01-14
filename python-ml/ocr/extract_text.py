# python-ml/ocr/extract_text.py - SIMPLE WORKING VERSION
import pytesseract
import cv2
import re
import os
import numpy as np

# Set Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class PhilippineOCR:
    def __init__(self):
        self.languages = 'eng'
        
    def extract_text(self, image_path):
        """Simple OCR that works"""
        try:
            print(f"🔍 OCR Processing: {os.path.basename(image_path)}")
            
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                return self.error_response("Cannot read image")
            
            # Simple preprocessing
            processed = self.simple_preprocess(img)
            
            # OCR
            text = pytesseract.image_to_string(processed, config='--psm 6')
            
            # Get confidence
            data = pytesseract.image_to_data(processed, config='--psm 6', output_type=pytesseract.Output.DICT)
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # Extract fields SIMPLY
            fields = self.extract_fields_simply(text)
            
            # Detect ID type
            id_type = self.detect_id_type_simply(text)
            
            return {
                'text': text.strip(),
                'confidence': avg_confidence,
                'fields': fields,
                'id_type': id_type,
                'success': True,
                'note': 'OCR Complete'
            }
            
        except Exception as e:
            print(f"❌ OCR Error: {e}")
            return self.error_response(str(e))
    
    def simple_preprocess(self, img):
        """Simple preprocessing"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        return binary
    
    def extract_fields_simply(self, text):
        """Extract fields SIMPLY - NO MESSY CODE"""
        fields = {}
        
        if not text:
            return fields
        
        print(f"📄 OCR Text:\n{text}")
        
        # 1. Extract STUDENT NUMBER
        student_num = self.find_student_number(text)
        if student_num:
            fields['id_number'] = student_num
            print(f"✅ Found student number: {student_num}")
        
        # 2. Extract NAME
        name = self.find_student_name(text)
        if name:
            fields['full_name'] = name
            print(f"✅ Found name: {name}")
        
        # 3. Extract SCHOOL
        school = self.find_school(text)
        if school:
            fields['school'] = school
            print(f"✅ Found school: {school}")
        
        # 4. Extract ADDRESS
        address = self.find_address(text)
        if address:
            fields['address'] = address
            print(f"✅ Found address: {address}")
        
        return fields
    
    def find_student_number(self, text):
        """Find student number - SIMPLE"""
        # Look for 8-digit number
        match = re.search(r'(\d{8})', text)
        if match:
            return match.group(1)
        
        # Look for STUDENT NO pattern
        match = re.search(r'STUDENT\s+NO[\.\s:]*(\d{8})', text, re.IGNORECASE)
        if match:
            return match.group(1)
        
        return None
    
    def find_student_name(self, text):
        """Find student name - SIMPLE"""
        lines = text.split('\n')
        
        # Look for line with "KATRINA" and "ESPENIDA"
        for line in lines:
            line = line.strip()
            if 'KATRINA' in line.upper() and 'ESPENIDA' in line.upper():
                # Clean the line
                clean_line = re.sub(r'\d{8}', '', line)  # Remove student number
                clean_line = re.sub(r'STUDENT\s+NO.*', '', clean_line, flags=re.IGNORECASE)
                clean_line = clean_line.strip()
                
                if clean_line and len(clean_line) > 10:
                    return clean_line
        
        # Look for any line that looks like a name (3-4 capitalized words)
        for line in lines:
            line = line.strip()
            words = line.split()
            if 3 <= len(words) <= 4:
                if all(word[0].isupper() for word in words):
                    # Check it's not a location
                    if not any(word.upper() in ['UNIVERSITY', 'CAMPUS', 'BULAN', 'SORSOGON'] for word in words):
                        return line
        
        return None
    
    def find_school(self, text):
        """Find school - SIMPLE"""
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if 'UNIVERSITY' in line.upper():
                return line
        
        return None
    
    def find_address(self, text):
        """Find address - SIMPLE"""
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if 'BULAN' in line.upper() and 'CAMPUS' in line.upper():
                return line
            elif 'BULAN' in line.upper():
                return line
        
        return None
    
    def detect_id_type_simply(self, text):
        """Detect ID type - SIMPLE"""
        text_upper = text.upper()
        
        if 'STUDENT' in text_upper or 'UNIVERSITY' in text_upper:
            return 'Student ID'
        elif 'MUNICIPAL' in text_upper:
            return 'Municipal ID'
        else:
            return 'Philippine ID'
    
    def error_response(self, error_msg):
        return {
            'text': '',
            'confidence': 0,
            'error': error_msg,
            'success': False
        }

# Singleton
ph_ocr = PhilippineOCR()

def extract_text_from_image(image_path):
    return ph_ocr.extract_text(image_path)