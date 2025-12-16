#!/bin/bash
# Parallax Watchdog - Auto-restart supervisor for all services

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

CHECK_INTERVAL=10
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_FILE="$SCRIPT_DIR/watchdog.log"
PARALLAX_RESTARTS=0
BACKEND_RESTARTS=0

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG_FILE"
    echo -e "$1"
}

start_parallax() {
    log "${CYAN}Starting Parallax engine...${NC}"
    cd "$SCRIPT_DIR/parallax-engine"
    source venv/bin/activate
    parallax run -m Qwen/Qwen2.5-0.5B-Instruct -n 1 > "$SCRIPT_DIR/parallax.log" 2>&1 &
    PARALLAX_PID=$!
    cd "$SCRIPT_DIR"
    
    for i in {1..90}; do
        if curl -s http://localhost:3001/v1/models > /dev/null 2>&1; then
            log "${GREEN}✓ Parallax started (PID: $PARALLAX_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    log "${RED}✗ Parallax failed to start${NC}"
    return 1
}

start_backend() {
    log "${CYAN}Starting Backend API...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
    
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
    BACKEND_PID=$!
    cd "$SCRIPT_DIR"
    
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            log "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
            return 0
        fi
        sleep 1
    done
    log "${RED}✗ Backend failed to start${NC}"
    return 1
}

check_parallax() { curl -s http://localhost:3001/v1/models > /dev/null 2>&1; }
check_backend() { curl -s http://localhost:8000/health > /dev/null 2>&1; }

cleanup() {
    echo ""
    log "${YELLOW}Shutting down...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    pkill -f "parallax run" 2>/dev/null || true
    log "${GREEN}Done. Restarts: Parallax=$PARALLAX_RESTARTS, Backend=$BACKEND_RESTARTS${NC}"
    exit 0
}

trap cleanup INT TERM

echo ""
echo -e "${CYAN}Parallax Watchdog${NC} - Auto-restart supervisor"
echo ""

log "Watchdog started (interval: ${CHECK_INTERVAL}s)"

if ! check_parallax; then start_parallax; fi
if ! check_backend; then start_backend; fi

echo ""
echo -e "${GREEN}All services running${NC}"
echo "  Parallax:  http://localhost:3001"
echo "  Backend:   http://localhost:8000"
echo "  Frontend:  file://$SCRIPT_DIR/frontend/index.html"
echo ""
echo "Monitoring... (Ctrl+C to stop)"
echo ""

while true; do
    sleep $CHECK_INTERVAL
    
    if ! check_parallax; then
        log "${RED}Parallax crashed - restarting...${NC}"
        PARALLAX_RESTARTS=$((PARALLAX_RESTARTS + 1))
        start_parallax
    fi
    
    if ! check_backend; then
        log "${RED}Backend crashed - restarting...${NC}"
        BACKEND_RESTARTS=$((BACKEND_RESTARTS + 1))
        start_backend
    fi
done
