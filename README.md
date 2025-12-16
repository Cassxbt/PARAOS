<div align="center">

# PARAOS

### Parallel Autonomous Real-time AI Operating System

**Private • Distributed • Lightning Fast**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776ab.svg?logo=python&logoColor=white)](https://python.org)
[![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-Optimized-000000.svg?logo=apple&logoColor=white)](https://support.apple.com/en-us/116943)
[![Parallax](https://img.shields.io/badge/Parallax-Powered-7c3aed.svg)](https://github.com/GradientHQ/parallax)

<br/>

<img src="parallax-engine/docs/images/parallax.png" alt="PARAOS Banner" width="600"/>

<br/>

*A next-generation local AI translation system powered by distributed inference.*

[Quick Start](#-quick-start) •
[Features](#-features) •
[Architecture](#-architecture) •
[API Reference](#-api-reference) •
[Contributing](#-contributing)

</div>

---

## 📋 Overview

**PARAOS** is an enterprise-grade, privacy-first translation system that leverages the Parallax distributed inference engine to deliver real-time multilingual translation entirely on-device. Built for the [Build your own AI Lab](https://gradient.network/campaign/) competition, it demonstrates the full potential of local AI on Apple Silicon.

> **Why PARAOS?**  
> Traditional translation services transmit your data to external servers. PARAOS keeps everything local — your text never leaves your machine, enabling secure translation of confidential documents, legal materials, and sensitive communications.

### Key Differentiators

| Capability | PARAOS | Cloud APIs |
|------------|--------|------------|
| **Privacy** | 100% local processing | Data transmitted externally |
| **Latency** | < 2s average | Network-dependent |
| **Cost** | Free, unlimited | Pay-per-character |
| **Offline** | Fully supported | Requires internet |
| **Data Retention** | None (user-controlled) | Varies by provider |

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### Core Capabilities

- 🔐 **Zero-Trust Privacy** — All inference runs locally via MLX
- ⚡ **Sub-2s Translations** — Optimized prompt engineering
- 🌍 **25+ Languages** — Comprehensive multilingual support
- 📄 **Document Processing** — Translate `.txt`, `.md`, `.srt` files
- 🎤 **Voice Input** — Native Web Speech API integration
- 📊 **Real-time Metrics** — Live inference time tracking

</td>
<td width="50%" valign="top">

### Advanced Features

- 🔄 **Auto Language Detection** — Smart source identification
- 💰 **Cost Comparison Dashboard** — Track savings vs. cloud providers
- 📜 **Translation History** — Persistent session storage
- ⌨️ **Keyboard Shortcuts** — Power-user workflow support
- 🌙 **Dark Mode UI** — Premium glassmorphic interface
- 🔊 **Text-to-Speech** — Audio playback of translations

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| macOS | 12.0+ | Apple Silicon required (M1/M2/M3/M4) |
| Python | 3.11+ | Virtual environment recommended |
| RAM | 8GB+ | 16GB recommended for optimal performance |
| Storage | 15GB+ | Model weights require ~14GB |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Cassxbt/PARAOS.git
cd PARAOS

# 2. Initialize and start the system
chmod +x start.sh
./start.sh
```

The startup script will automatically:
- Set up Python virtual environments
- Install all dependencies
- Initialize the Parallax engine with Qwen2.5-7B
- Start the FastAPI backend server
- Launch the frontend interface

### Manual Setup

<details>
<summary><strong>Click to expand manual installation steps</strong></summary>

#### Step 1: Install Parallax Engine

```bash
cd parallax-engine
python3 -m venv ./venv
source ./venv/bin/activate
pip install -e '.[mac]'
```

#### Step 2: Start Parallax with Qwen2.5

```bash
parallax run -m Qwen/Qwen2.5-7B-Instruct -n 1
# Scheduler available at http://localhost:3001
```

> **Note:** First-time model download requires ~14GB and may take 10-20 minutes.

#### Step 3: Configure Backend

```bash
cd backend
python3 -m venv ./venv
source ./venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Step 4: Launch Frontend

```bash
open frontend/index.html
# Or serve via: python3 -m http.server 3000 -d frontend
```

</details>

---

## 🏗 Architecture

```
                                    ┌──────────────────────────────────────┐
                                    │           PARAOS System              │
                                    └──────────────────────────────────────┘

    ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
    │                 │  HTTP   │                 │  HTTP   │                 │
    │    Frontend     │────────▶│  FastAPI        │────────▶│   Parallax      │
    │  Dynamic Island │         │  Backend        │         │   Scheduler     │
    │                 │◀────────│                 │◀────────│                 │
    │    :3000        │   JSON  │    :8000        │   JSON  │    :3001        │
    └─────────────────┘         └─────────────────┘         └────────┬────────┘
                                                                     │
                                        ┌────────────────────────────┘
                                        │
                                        ▼
                                ┌───────────────────┐
                                │                   │
                                │    Qwen2.5-7B     │
                                │    Instruct       │
                                │                   │
                                │  ┌─────────────┐  │
                                │  │  MLX Core   │  │
                                │  │  (Metal)    │  │
                                │  └─────────────┘  │
                                │                   │
                                └───────────────────┘
                                   Apple Silicon
```

### Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Vanilla JS, CSS | Dynamic Island UI with glassmorphic design |
| **Backend** | FastAPI, Python | API routing, caching, translation orchestration |
| **Parallax Engine** | MLX, gRPC | Distributed inference scheduling |
| **Model** | Qwen2.5-7B-Instruct | Multilingual translation model |

---

## 📡 API Reference

### Endpoints

#### Health Check
```http
GET /
```
Returns system status including Parallax connectivity.

---

#### Translate Text
```http
POST /api/translate
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Hello, world!",
  "source_lang": "en",
  "target_lang": "es"
}
```

**Response:**
```json
{
  "translation": "¡Hola, mundo!",
  "source_lang": "en",
  "target_lang": "es",
  "inference_time": 1.23,
  "model": "Qwen2.5-7B-Instruct"
}
```

---

#### Streaming Translation
```http
POST /api/translate/stream
Content-Type: application/json
```
Real-time token-by-token translation via Server-Sent Events (SSE).

---

#### List Languages
```http
GET /api/languages
```
Returns all supported language codes and display names.

---

#### Translation History
```http
GET /api/history
DELETE /api/history
```
Retrieve or clear translation history.

---

#### Statistics
```http
GET /api/stats
```
Returns aggregate translation metrics and cost savings.

---

## 🌐 Supported Languages

<details>
<summary><strong>View all 25+ supported languages</strong></summary>

| Code | Language | Code | Language |
|------|----------|------|----------|
| `en` | English | `ko` | Korean |
| `es` | Spanish | `ar` | Arabic |
| `fr` | French | `ru` | Russian |
| `de` | German | `hi` | Hindi |
| `it` | Italian | `tr` | Turkish |
| `pt` | Portuguese | `pl` | Polish |
| `zh` | Chinese | `nl` | Dutch |
| `ja` | Japanese | `sv` | Swedish |
| `th` | Thai | `no` | Norwegian |
| `vi` | Vietnamese | `da` | Danish |
| `id` | Indonesian | `fi` | Finnish |
| `ms` | Malay | `el` | Greek |
| `he` | Hebrew | | |

</details>

---

## 📊 Performance

Benchmarked on MacBook Air M1 (8GB RAM):

| Input Size | Avg. Latency | Throughput |
|------------|--------------|------------|
| < 100 chars | 1.2s | ~83 char/s |
| 100-500 chars | 1.8s | ~167 char/s |
| 500-1000 chars | 2.5s | ~300 char/s |
| 1000-2000 chars | 3.8s | ~395 char/s |

> **Performance Note:** First translation after cold start may take 5-10s for model initialization.

---

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PARALLAX_HOST` | `localhost` | Parallax scheduler hostname |
| `PARALLAX_PORT` | `3001` | Parallax scheduler port |
| `BACKEND_PORT` | `8000` | FastAPI server port |
| `MODEL_NAME` | `Qwen/Qwen2.5-7B-Instruct` | HuggingFace model identifier |

---

## 🐛 Troubleshooting

<details>
<summary><strong>"Parallax Offline" Error</strong></summary>

Ensure the Parallax scheduler is running:
```bash
cd parallax-engine && source venv/bin/activate
parallax run -m Qwen/Qwen2.5-7B-Instruct -n 1
```

</details>

<details>
<summary><strong>"Backend Offline" Error</strong></summary>

Start the FastAPI server:
```bash
cd backend && source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

</details>

<details>
<summary><strong>Slow Translations (> 5s)</strong></summary>

- Close memory-intensive applications
- Reduce input text length (< 500 chars recommended)
- Allow 1-2 warmup translations after cold start

</details>

<details>
<summary><strong>Voice Input Not Working</strong></summary>

- Use Chrome or Safari (best Web Speech API support)
- Ensure microphone permissions are granted
- Check browser console for errors

</details>

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/PARAOS.git

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git commit -m "feat: description of changes"

# Push and create PR
git push origin feature/your-feature-name
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Gradient Network](https://gradient.network)** — Parallax distributed inference engine
- **[Qwen Team](https://github.com/QwenLM)** — Qwen2.5 model family
- **[Apple MLX](https://github.com/ml-explore/mlx)** — Metal-accelerated ML framework

---

<div align="center">

**[⬆ Back to Top](#paraos)**

<br/>

Built with precision for the **[Build Your Own AI Lab](https://gradient.network/campaign/)** Competition

<br/>

<sub>© 2024 PARAOS Contributors. All rights reserved.</sub>

</div>
