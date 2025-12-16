<div align="center">

# 🌐 PARAOS

**Privacy-First AI Translation Operating System**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Qwen](https://img.shields.io/badge/AI-Qwen%202.5--7B-8B5CF6)](https://qwen.ai)
[![MLX](https://img.shields.io/badge/Backend-MLX-FF6B35)](https://github.com/ml-explore/mlx)

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-reference">API</a> •
  <a href="https://x.com/cassxbt">Twitter</a>
</p>

</div>

---

## 📖 Overview

**PARAOS** is an enterprise-grade, privacy-first translation system that leverages the Parallax distributed inference engine to deliver real-time multilingual translation entirely on-device. Built for the [Build your own AI Lab](https://lablab.ai) competition, it demonstrates the full potential of local AI on Apple Silicon.

> ### Why PARAOS?
> Traditional translation services transmit your data to external servers. PARAOS keeps everything local — your text never leaves your machine, enabling secure translation of confidential documents, legal materials, and sensitive communications.

### Key Differentiators

| Capability | PARAOS | Cloud APIs |
|:-----------|:------:|:----------:|
| **Privacy** | 100% local processing | Data transmitted externally |
| **Latency** | < 2s average | Network-dependent |
| **Cost** | Free, unlimited | Pay-per-character |
| **Offline** | Fully supported | Requires internet |
| **Data Retention** | None (user-controlled) | Varies by provider |

---

## ✨ Features

### 🎤 Voice Translation
Real-time speech-to-text transcription with instant translation. Supports continuous voice input with automatic language detection.

### 📄 Document Translation
Upload and translate entire documents while preserving formatting:
- **PDF** — Text extraction with layout preservation
- **DOCX** — Full Microsoft Word support
- **TXT** — Plain text files

### 🌍 Multi-Language Support
Translate between **20+ languages** including:

| Tier 1 (Optimized) | Tier 2 (Supported) |
|:-------------------|:-------------------|
| English, Chinese, Spanish | Arabic, Hindi, Portuguese |
| French, German, Japanese | Russian, Korean, Italian |

### 🎨 Dynamic Island Interface
iOS-inspired UI with premium animations:
- Spring-based state transitions
- Floating shadow effects
- Glassmorphism design language
- Responsive micro-interactions

### ⚡ Local Inference
Powered by **Qwen 2.5-7B Instruct** via the Parallax Engine:
- **MLX backend** optimized for Apple Silicon (M1/M2/M3/M4)
- **8-bit quantization** for memory efficiency
- **Continuous batching** for throughput optimization
- **< 2s** average translation latency

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PARAOS System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐     HTTP     ┌──────────────────┐        │
│  │     Frontend     │◄────────────►│     FastAPI      │        │
│  │  Dynamic Island  │              │     Backend      │        │
│  │      :3000       │     JSON     │      :8000       │        │
│  └──────────────────┘              └────────┬─────────┘        │
│                                             │                   │
│                                             │ HTTP              │
│                                             ▼                   │
│                                    ┌──────────────────┐        │
│                                    │    Parallax      │        │
│                                    │    Scheduler     │        │
│                                    │      :3001       │        │
│                                    └────────┬─────────┘        │
│                                             │                   │
│                                             ▼                   │
│                                    ┌──────────────────┐        │
│                                    │  Qwen2.5-7B      │        │
│                                    │    Instruct      │        │
│                                    ├──────────────────┤        │
│                                    │    MLX Core      │        │
│                                    │    (Metal)       │        │
│                                    └──────────────────┘        │
│                                                                 │
│                                      Apple Silicon              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Technology | Port | Description |
|:----------|:-----------|:----:|:------------|
| **Frontend** | HTML/CSS/JS | 3000 | Dynamic Island UI with voice/document input |
| **Backend** | FastAPI (Python) | 8000 | Translation orchestration and file processing |
| **Scheduler** | Parallax Engine | 3001 | Request routing and model management |
| **Inference** | MLX + Qwen 2.5 | — | On-device language model inference |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Minimum | Recommended |
|:------------|:--------|:------------|
| **OS** | macOS 13+ | macOS 14+ |
| **Chip** | M1 | M2 Pro / M3 |
| **RAM** | 16GB | 32GB |
| **Python** | 3.10 | 3.11+ |
| **Disk** | 20GB free | 40GB free |

### Installation

```bash
# Clone the repository
git clone https://github.com/Cassxbt/PARAOS.git
cd PARAOS

# Start all services (one command)
./start.sh
```

The startup script will:
1. ✅ Create Python virtual environment
2. ✅ Install all dependencies (MLX, FastAPI, etc.)
3. ✅ Download Qwen 2.5-7B model (~8GB, first run only)
4. ✅ Start Parallax inference engine
5. ✅ Launch translation backend
6. ✅ Open frontend in browser

### Manual Startup

```bash
# Terminal 1: Start Parallax Engine
cd parallax-engine
source venv/bin/activate
python -m parallax.main --model Qwen/Qwen2.5-7B-Instruct --port 30000

# Terminal 2: Start Backend
cd backend
python main.py --port 5001

# Terminal 3: Serve Frontend
cd frontend
python -m http.server 8000
```

---

## 📡 API Reference

### Translation Endpoint

```http
POST /translate
Content-Type: application/json
```

**Request:**
```json
{
  "text": "Hello, world!",
  "source_lang": "en",
  "target_lang": "zh"
}
```

**Response:**
```json
{
  "translated_text": "你好，世界！",
  "source_lang": "en",
  "target_lang": "zh",
  "latency_ms": 1847
}
```

### Document Translation

```http
POST /translate/document
Content-Type: multipart/form-data
```

| Parameter | Type | Required | Description |
|:----------|:-----|:--------:|:------------|
| `file` | File | ✅ | PDF, DOCX, or TXT file |
| `target_lang` | String | ✅ | Target language code |
| `source_lang` | String | ❌ | Source language (auto-detect if omitted) |

### Supported Language Codes

| Code | Language | Code | Language |
|:-----|:---------|:-----|:---------|
| `en` | English | `ko` | Korean |
| `zh` | Chinese (Simplified) | `ar` | Arabic |
| `es` | Spanish | `pt` | Portuguese |
| `fr` | French | `ru` | Russian |
| `de` | German | `hi` | Hindi |
| `ja` | Japanese | `it` | Italian |

---

## 🐳 Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PARALLAX_PORT` | `30000` | Parallax engine API port |
| `BACKEND_PORT` | `5001` | Translation backend port |
| `FRONTEND_PORT` | `8000` | Frontend server port |
| `MODEL_NAME` | `Qwen/Qwen2.5-7B-Instruct` | HuggingFace model ID |
| `QUANTIZATION` | `8bit` | Model quantization level |

---

## 📊 Performance Benchmarks

Tested on MacBook Pro M3 Max (48GB RAM):

| Operation | Latency | Throughput |
|:----------|--------:|:-----------|
| Text translation (< 100 chars) | 0.8s | 125 chars/s |
| Text translation (< 1000 chars) | 1.9s | 526 chars/s |
| Document (1-page PDF) | 4.2s | — |
| Document (10-page PDF) | 38s | — |
| Voice transcription | Real-time | — |

---

## 🛠 Development

### Project Structure

```
PARAOS/
├── frontend/               # Dynamic Island UI
│   ├── index.html         # Main application
│   ├── app.js             # Application logic
│   └── Dockerfile
├── backend/                # Translation API
│   ├── main.py            # FastAPI server
│   ├── parallax_client.py # Parallax integration
│   └── Dockerfile
├── parallax-engine/        # AI inference engine
│   ├── src/parallax/      # Core engine code
│   └── venv/              # Python environment
├── start.sh               # One-click startup
├── watchdog.sh            # Process monitor
└── docker-compose.yml     # Container orchestration
```

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests (browser)
open frontend/tests/index.html
```

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the AI Lab Competition**

[**@cassxbt**](https://x.com/cassxbt)

</div>
