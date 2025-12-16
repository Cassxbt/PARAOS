<div align="center">
  <h1>🌐 PARAOS</h1>
  <p><strong>Parallax Translation Assistant</strong></p>
  <p>An AI-powered real-time translation platform featuring voice input, document translation, and a stunning Dynamic Island interface.</p>

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Made with Qwen](https://img.shields.io/badge/AI-Qwen%202.5-purple)](https://qwen.ai)

</div>

---

## ✨ Features

- **🎤 Voice Translation** - Real-time voice input with transcription and translation
- **📄 Document Translation** - Upload and translate PDF, DOCX, and TXT files
- **🌍 Multi-Language Support** - Translate between 20+ languages
- **🎨 Dynamic Island UI** - iOS-inspired interface with smooth animations
- **⚡ Fast Inference** - Powered by Qwen 2.5 via Parallax Engine

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js (optional, for frontend development)
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/Cassxbt/PARAOS.git
cd PARAOS

# Start the application
./start.sh
```

This will:
1. Set up the Python virtual environment
2. Start the Parallax Engine with Qwen model
3. Launch the backend translation server
4. Open the frontend in your browser

## 🏗️ Architecture

```
PARAOS/
├── frontend/           # Dynamic Island UI (HTML/CSS/JS)
├── backend/            # Flask translation API
├── parallax-engine/    # AI inference engine (Qwen 2.5)
├── start.sh           # One-click startup script
└── docker-compose.yml  # Docker deployment config
```

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PARALLAX_PORT` | `30000` | Parallax engine API port |
| `BACKEND_PORT` | `5001` | Translation backend port |
| `FRONTEND_PORT` | `8000` | Frontend server port |

## 📦 Deployment

### Deploy to Vercel (Frontend)

The frontend can be deployed to Vercel as a static site:

1. Push to GitHub
2. Connect to Vercel
3. Set root directory to `frontend`
4. Deploy!

### Docker Deployment

```bash
docker-compose up -d
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Built with ❤️ by [Cassxbt](https://x.com/cassxbt)**

</div>
</CodeContent>
<parameter name="EmptyFile">false
