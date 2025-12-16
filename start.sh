#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════╗
# ║  Parallax Translator - TRUE One-Click Start                   ║
# ║  Competition Entry for "Build Your Own AI Lab"                 ║
# ╚═══════════════════════════════════════════════════════════════╝

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  🌐 ${BLUE}Parallax Translator${NC} - One-Click Start                     ${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════════════════════════
# STEP 1: Check/Start Parallax Inference Engine
# ═══════════════════════════════════════════════════════════════
echo -e "${YELLOW}📡 Step 1: Checking Parallax inference engine...${NC}"

if curl -s http://localhost:3001/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Parallax is already running on port 3001${NC}"
else
    echo "   ⚠️  Parallax not detected. Attempting to start..."
    
    # Check for parallax-engine directory
    if [ -d "parallax-engine" ] && [ -f "parallax-engine/venv/bin/activate" ]; then
        echo "   📂 Found parallax-engine directory"
        cd parallax-engine
        source venv/bin/activate
        
        echo -e "${CYAN}   🚀 Starting Parallax (this may take 30-60s for model loading)...${NC}"
        parallax run -m Qwen/Qwen2.5-0.5B-Instruct -n 1 > ../parallax.log 2>&1 &
        PARALLAX_PID=$!
        echo "      PID: $PARALLAX_PID"
        
        cd ..
        
        # Wait for Parallax to be ready
        echo -n "   ⏳ Waiting for model to load"
        for i in {1..60}; do
            if curl -s http://localhost:3001/v1/models > /dev/null 2>&1; then
                echo ""
                echo -e "${GREEN}   ✅ Parallax is ready!${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
        
        if ! curl -s http://localhost:3001/v1/models > /dev/null 2>&1; then
            echo ""
            echo -e "${RED}   ❌ Parallax failed to start. Check parallax.log${NC}"
            exit 1
        fi
    else
        echo -e "${RED}   ❌ Parallax not installed. Please run:${NC}"
        echo ""
        echo "      git clone https://github.com/GradientHQ/parallax.git parallax-engine"
        echo "      cd parallax-engine"
        echo "      python3 -m venv venv"
        echo "      source venv/bin/activate"
        echo "      pip install -e '.[mac]'"
        echo ""
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 2: Start Backend API Server
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}🐍 Step 2: Starting Backend API...${NC}"
cd backend

# Create/activate virtualenv
if [ ! -d "venv" ]; then
    echo "   📦 Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt -q
else
    source venv/bin/activate
fi

# Kill any existing backend process on port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Start Uvicorn
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}   ✅ Backend started (PID: $BACKEND_PID)${NC}"

cd ..

# Wait for backend
sleep 2
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Backend is healthy${NC}"
else
    echo -e "${YELLOW}   ⏳ Backend still starting...${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# STEP 3: Open Frontend
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}🌐 Step 3: Opening Frontend...${NC}"

FRONTEND_PATH="file://$SCRIPT_DIR/frontend/index.html"

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$SCRIPT_DIR/frontend/index.html"
    echo -e "${GREEN}   ✅ Opened in default browser${NC}"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$SCRIPT_DIR/frontend/index.html" 2>/dev/null || true
fi

# ═══════════════════════════════════════════════════════════════
# SUCCESS!
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Parallax Translator is LIVE!${NC}"
echo ""
echo "   🌐 Frontend:  Opened in browser"
echo "   📊 API Docs:  http://localhost:8000/docs"
echo "   🔌 Parallax:  http://localhost:3001"
echo ""
echo "   📂 Logs:"
echo "      • Backend:  backend/backend.log"
echo "      • Parallax: parallax.log"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}Done!${NC}"
    exit 0
}

trap cleanup INT TERM

# Keep script running
wait $BACKEND_PID
