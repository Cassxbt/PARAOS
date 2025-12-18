#!/bin/bash
# PARAOS Mobile Access Script
# Starts backend + ngrok tunnel for mobile device access

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              PARAOS Mobile Access Setup                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}⚠ ngrok not found. Installing via Homebrew...${NC}"
    brew install ngrok
fi

# Check if ngrok is authenticated
if ! ngrok config check &> /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}⚠ ngrok needs authentication (free account required)${NC}"
    echo ""
    echo "1. Go to: https://dashboard.ngrok.com/signup"
    echo "2. Sign up for free"
    echo "3. Copy your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "4. Run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    read -p "Press Enter after completing setup, or Ctrl+C to cancel..."
fi

# Start backend if not running
echo -e "${BLUE}Checking backend status...${NC}"
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting backend services...${NC}"
    "$SCRIPT_DIR/start.sh" &
    
    # Wait for backend to be ready
    echo -e "${BLUE}Waiting for backend to start...${NC}"
    for i in {1..120}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is ready${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
else
    echo -e "${GREEN}✓ Backend already running${NC}"
fi

# Start ngrok tunnel
echo ""
echo -e "${BLUE}Starting ngrok tunnel...${NC}"
echo ""

# Run ngrok and capture the URL
ngrok http 8000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get URL
sleep 3

# Try to get the public URL from ngrok API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo -e "${YELLOW}Waiting for ngrok to initialize...${NC}"
    sleep 5
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
fi

if [ -n "$NGROK_URL" ]; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🎉 MOBILE ACCESS READY!                   ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  📱 Open this URL on your phone:                            ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${CYAN}║  ${NGROK_URL}${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Or use Vercel with API param:                              ║${NC}"
    echo -e "${CYAN}║  https://paraos.vercel.app/?api=${NGROK_URL}${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Tunnel is running. Press Ctrl+C to stop.${NC}"
    echo ""
    
    # Generate QR code if qrencode is available
    if command -v qrencode &> /dev/null; then
        echo -e "${BLUE}Scan this QR code with your phone:${NC}"
        qrencode -t ANSI256 "$NGROK_URL"
    fi
    
    # Keep running
    wait $NGROK_PID
else
    echo -e "${YELLOW}Could not automatically detect ngrok URL.${NC}"
    echo -e "${BLUE}Check ngrok dashboard: http://localhost:4040${NC}"
    echo ""
    echo -e "${YELLOW}Tunnel is running. Press Ctrl+C to stop.${NC}"
    wait $NGROK_PID
fi

# Cleanup on exit
trap "kill $NGROK_PID 2>/dev/null; echo 'Tunnel closed.'" EXIT
