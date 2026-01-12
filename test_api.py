from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'Philippine Document ML API',
        'purpose': 'Barangay Lajong Document Verification'
    })

@app.route('/test')
def test():
    return jsonify({
        'message': 'CNN and OCR ready for Philippine documents',
        'document_types': [
            'Philippine Passport',
            'Drivers License (LTO)',
            'National ID (PhilSys)',
            'Barangay ID'
        ]
    })

if __name__ == '__main__':
    print("🚀 Starting Philippine Document ML API...")
    print("   Port: 5000")
    print("   Purpose: Barangay Lajong Document Verification")
    app.run(host='0.0.0.0', port=5000, debug=True)