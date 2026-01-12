# python-ml/cnn/utils.py
import os
import cv2
import numpy as np

def load_philippine_document_types():
    """Return Philippine document types for Barangay Lajong"""
    return [
        'Philippine Passport',
        'UMID (Unified Multi-Purpose ID)',
        'Drivers License (LTO)',
        'Postal ID',
        'National ID (PhilSys)',
        'SSS ID (Social Security System)',
        'Voters ID',
        'PhilHealth ID',
        'Municipal ID',
        'Barangay ID',
        'Student ID'
    ]

def preprocess_image(image_path, target_size=(224, 224)):
    """Preprocess image for CNN"""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    
    # Convert BGR to RGB
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Resize
    img = cv2.resize(img, target_size)
    
    # Normalize
    img = img.astype('float32') / 255.0
    
    return img

def get_document_category(document_type):
    """Categorize as Primary or Secondary"""
    primary_docs = [
        'Philippine Passport', 'UMID', 'Drivers License', 'Postal ID',
        'National ID', 'SSS ID', 'Voters ID', 'PhilHealth ID'
    ]
    
    return 'Primary' if any(doc in document_type for doc in primary_docs) else 'Secondary'