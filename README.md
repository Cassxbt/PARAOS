# PARAOS

Privacy-first local AI translation on Apple Silicon. Qwen 2.5-7B via MLX. Voice input, document processing (PDF, DOCX, TXT), 20+ languages. Your data never leaves your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Platform](https://img.shields.io/badge/Platform-Apple%20Silicon-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/cassxbt/PARAOS)
[![Model](https://img.shields.io/badge/Model-Qwen%202.5--7B-orange?style=flat-square)](https://github.com/cassxbt/PARAOS)

<!-- TODO: Add demo.gif — screen capture of the Dynamic Island UI translating a short phrase and a PDF document -->

## Overview

PARAOS runs a complete translation stack entirely on-device using Apple's Metal GPU. There is no API call, no data upload, no usage limit. The Qwen 2.5-7B model (~8GB) is downloaded once on first launch and accelerated via MLX. Three local services start from a single script: a React frontend, a FastAPI backend, and the Parallax Engine scheduler that manages inference load. Sensitive documents — legal, medical, financial — can be translated without leaving the machine.

## Features

- **100% local processing** — no external API calls, no data transmitted, no rate limits
- **Voice translation** — real-time speech-to-text with automatic language detection
- **Document processing** — PDF, DOCX, and TXT with formatting preservation
- **20+ languages** across two optimization tiers (quality vs. speed)
- **Single-command startup** — one script provisions the environment, downloads the model, and starts all three services
- **Metal GPU acceleration** — Qwen 2.5-7B via MLX, optimized for Apple Silicon

## Architecture

```
┌─────────────────────────────────────────────┐
│              PARAOS Stack                   │
├──────────────────┬──────────────────────────┤
│ Frontend :3000   │  React · Dynamic Island UI│
│ Backend  :8000   │  FastAPI · orchestration  │
│ Parallax :3001   │  Request scheduler        │
├──────────────────┴──────────────────────────┤
│ Inference  Qwen 2.5-7B · MLX · Metal GPU    │
└─────────────────────────────────────────────┘
```

## Performance

Measured on M3 Max:

| Input | Latency |
|---|---|
| Short phrase (< 20 words) | ~0.8s |
| Long passage (200+ words) | ~1.9s |

## Requirements

- Apple Silicon Mac (M1 or later)
- ~10GB free disk space (model + system)
- Python 3.10+
- Node.js 18+

## Quickstart

```bash
git clone https://github.com/cassxbt/PARAOS
cd PARAOS
./start.sh
```

`start.sh` provisions the Python environment, downloads the Qwen 2.5-7B model on first run (~8GB), and starts all three services. Open [http://localhost:3000](http://localhost:3000) when the logs show all services ready.

## Tech Stack

| Component | Technology |
|---|---|
| Model | Qwen 2.5-7B |
| Inference | MLX (Apple Silicon / Metal) |
| Backend | FastAPI + uvicorn |
| Frontend | React + TypeScript |
| Scheduler | Parallax Engine |
| Document parsing | PyPDF2 · python-docx |
| Containerization | Docker Compose |

## Supported Languages

20+ languages across two tiers:

| Tier | Languages | Characteristic |
|---|---|---|
| Quality | English, Spanish, French, German, Chinese, Japanese, Arabic, Portuguese, Russian, Korean | Full model depth, higher accuracy |
| Speed | Additional 10+ languages | Optimized for latency |

## Contributing

Pull requests are welcome. For major changes, open an issue first. The Parallax Engine and backend each have independent test suites — run both before submitting.

## License

MIT
