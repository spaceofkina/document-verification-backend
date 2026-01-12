@echo off
echo ========================================
echo Philippine Document ML Setup for Windows
echo ========================================
echo.
echo This will install Python dependencies for:
echo 1. CNN Document Classification (TensorFlow)
echo 2. OCR Text Extraction (Tesseract)
echo 3. Flask API Server
echo.
echo For Barangay Lajong Document Verification System
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found!
    echo Please install Python 3.8+ from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python detected

REM Install Python packages
echo.
echo 📦 Installing Python packages...
pip install --upgrade pip
pip install tensorflow opencv-python flask flask-cors pillow numpy scikit-learn

echo.
echo 📦 Installing Tesseract OCR...
echo Please download and install Tesseract from:
echo https://github.com/UB-Mannheim/tesseract/wiki
echo.
echo After installing Tesseract, add it to PATH:
echo C:\Program Files\Tesseract-OCR
echo.

REM Create directories
mkdir saved_models 2>nul
mkdir logs 2>nul

echo.
echo ✅ Setup complete!
echo.
echo To start the ML service:
echo 1. cd python-ml
echo 2. python run.py
echo.
echo The service will run on: http://localhost:5001
echo.
pause