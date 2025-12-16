#!/bin/bash

# Parallax Translator - Quick Start Script
# This script starts the FastAPI backend server

echo "🚀 Starting Parallax Translator Backend..."
echo ""

# Check if we're in the correct directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the backend directory."
    exit 1
fi

# Check if dependencies are installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements.txt
    echo ""
fi

echo "✅ Starting server on http://localhost:8000"
echo "📝 Logs will appear below. Press Ctrl+C to stop."
echo ""
echo "🌐 Open frontend/index.html in your browser to use the translator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
