---
description: Start up the Parallax Translation Assistant (backend + Qwen AI model)
---

# Parallax Translation Assistant Startup

## Overview
This project uses **Parallax** (not Ollama) for local AI inference. Parallax is a distributed AI inference engine from Gradient.

**Key URLs:**
- https://gradient.network/research/parallax-your-sovereign-ai-os
- https://github.com/GradientHQ/parallax

---

## ⚡ Quick Start (Recommended)

### Step 1: Start Parallax in Standalone Mode
```bash
cd /Users/apple/parralax/parallax-engine
source venv/bin/activate
# turbo
python3 src/parallax/launch.py \
  --model-path Qwen/Qwen2.5-0.5B-Instruct \
  --port 3001 \
  --start-layer 0 \
  --end-layer 24 \
  --max-num-tokens-per-batch 4096 \
  --max-sequence-length 2048 \
  > ../parallax.log 2>&1 &
```

Wait ~30 seconds for model to load. Check logs:
```bash
tail -f /Users/apple/parralax/parallax.log
```

Look for: `Successfully loaded model shard` and `Uvicorn running on http://localhost:3001`

### Step 2: Start Backend API
```bash
cd /Users/apple/parralax/backend
source venv/bin/activate
# turbo
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### Step 3: Open Frontend
```bash
open /Users/apple/parralax/frontend/index.html
```

---

## ✅ Verify All Systems Online

```bash
# Check Parallax is running (should return HTML, NOT "Not Found")
curl -s http://localhost:3001/ | head -5

# Check Backend health
curl -s http://localhost:8000/health

# Test translation
curl -s -X POST http://localhost:8000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello", "source_lang": "auto", "target_lang": "es"}'
```

Expected: `{"translation":"Hola"...}`

---

## 🚫 What NOT To Do

1. **Do NOT use `parallax run -n 1`** - This starts scheduler mode which requires P2P relay discovery
2. **Do NOT use `parallax join`** - Same issue with P2P discovery
3. **Do NOT expect `/v1/models` to work** - This endpoint returns 404 in standalone mode (normal)

---

## 🔧 Architecture Notes

| Component | Port | Description |
|-----------|------|-------------|
| Parallax (launch.py) | 3001 | Local AI inference with Qwen model |
| Backend API (FastAPI) | 8000 | Translation endpoints, caching, history |
| Frontend | file:// | Static HTML/JS UI |

### How Parallax Works Locally

When running **without** `--scheduler-addr`, Parallax runs in **standalone mode**:
- Loads model shards directly (layers 0-24 for Qwen2.5-0.5B)
- Starts HTTP server for OpenAI-compatible API
- No P2P networking required

The backend calls `http://localhost:3001/v1/chat/completions` for translations.

---

## 📁 Important Files

- `/Users/apple/parralax/parallax-engine/` - Parallax source code
- `/Users/apple/parralax/backend/parallax_client.py` - Backend client (timeout: 60s)
- `/Users/apple/parralax/parallax.log` - Parallax logs
- `/Users/apple/parralax/backend/backend.log` - Backend logs

---

## 🛠 Troubleshooting

### Translation Timeout
Increase timeout in `backend/parallax_client.py`:
```python
self.timeout = 60.0  # or higher
```

### "Cannot connect to Parallax"
Check if Parallax process is running:
```bash
ps aux | grep parallax | grep -v grep
```

### Kill All and Restart
```bash
pkill -f "launch.py"
pkill -f "uvicorn main:app"
# Then run startup steps again
```
