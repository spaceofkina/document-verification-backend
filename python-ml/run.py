# python-ml/run.py
import sys
import os

print("🚀 Philippine Document ML Service for Barangay Lajong")
print("=" * 60)
print("Service: Intelligent Document Processing System")
print("Location: Barangay Lajong, Bulan, Sorsogon")
print("Components: CNN Document Classification + OCR Text Extraction")
print("=" * 60)

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Start the API
from api.ml_api import app

if __name__ == '__main__':
    print("\n🌐 Starting Flask API on http://localhost:5001")
    print("📚 API Endpoints:")
    print("   • GET  /health          - Service health")
    print("   • POST /classify        - Classify document type")
    print("   • POST /ocr/extract     - Extract text from document")
    print("   • POST /train           - Train CNN with Philippine documents")
    print("   • POST /verify/match    - Verify document match")
    print("\n🎓 Thesis Demonstration Ready!")
    app.run(host='0.0.0.0', port=5001, debug=True)