import tensorflow as tf
import cv2
import flask
import numpy as np
import pytesseract
from flask_cors import CORS

print("🎉 Philippine Document ML Setup Complete!")
print("========================================")
print(f"✅ TensorFlow: {tf.__version__}")
print(f"✅ OpenCV: {cv2.__version__}")
print(f"✅ Flask: {flask.__version__}")
print(f"✅ NumPy: {np.__version__}")
print(f"✅ GPU Available: {len(tf.config.list_physical_devices('GPU')) > 0}")
print()
print("🚀 Ready for Barangay Lajong Document Verification!")
print("Start with: python run.py")