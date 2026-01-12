# start_api.py
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({
        "service": "Philippine Document ML API",
        "purpose": "Barangay Lajong Document Verification",
        "framework": "Flask + TensorFlow",
        "status": "running"
    })

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "port": 5000,
        "cnn": "TensorFlow 2.20.0",
        "ocr": "Tesseract ready",
        "thesis": "Intelligent Document Request Processing System"
    })

@app.route('/test')
def test():
    return jsonify({
        "message": "API is working!",
        "document_types": [
            "Philippine Passport",
            "Drivers License (LTO)",
            "Barangay ID",
            "Student ID"
        ]
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 PHILIPPINE DOCUMENT ML API")
    print("=" * 60)
    print("Port: 5000")
    print("Framework: Flask + TensorFlow")
    print("Purpose: Barangay Lajong Document Verification")
    print("=" * 60)
    print("Endpoints:")
    print("  http://localhost:5000")
    print("  http://localhost:5000/health")
    print("  http://localhost:5000/test")
    print("=" * 60)
    
    # Start the server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,  # Set to False for production
        use_reloader=False  # Important: prevents double startup
    )