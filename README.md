# 🌐 Parallax Translator

> 100% Local. 100% Private. Lightning-fast AI translation powered by Parallax.

A local AI translation assistant built for the [Build your own AI Lab](https://gradient.network/campaign/) competition. This application runs completely on your MacBook Air M1 using Parallax distributed inference with Qwen2.5 model.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Parallax](https://img.shields.io/badge/Parallax-Powered-purple.svg)

## ✨ Features

### Core Features
- 🔒 **100% Private** - All processing happens locally, zero external API calls
- ⚡ **Lightning Fast** - Sub-2-second translations optimized for speed
- 📄 **Document Translation** - Translate .txt, .md, .srt files instantly
- 💰 **Multi-Provider Cost Tracker** - Real-time savings vs Google/AWS/GPT-4
- 🌍 **25+ Languages** - Comprehensive multilingual support
- 🎤 **Voice Input** - Speak your text using Web Speech API
- 📊 **Real-time Metrics** - Live performance dashboard showing inference times
- 📜 **Translation History** - Keep track of your recent translations
- 🌙 **Premium Dark UI** - Beautiful glassmorphism design with Tailwind CSS


### Advanced Features
- Auto-language detection
- Character counter (up to 5000 chars)
- Copy to clipboard
- Text-to-speech for translations
- Offline mode indicator
- Keyboard shortcuts (Ctrl/Cmd + Enter to translate)

## 🏆 Competition Criteria

This project addresses all key judging criteria:

| Criteria | Implementation |
|----------|----------------|
| **Privacy** | 100% local inference, no external APIs, complete offline capability |
| **Speed** | Optimized prompts, <2s average translation, real-time metrics display |
| **Usefulness** | Practical translation tool, voice input, 25+ languages, clean UX |
| **Impact** | Helps individuals/businesses needing private translation at zero cost |

## 🚀 Quick Start

### Prerequisites

- **macOS** with Apple Silicon (M1/M2/M3)
- **Python** 3.11 or higher
- **Git**

### 1. Install Parallax

```bash
# Clone Parallax repository
git clone https://github.com/GradientHQ/parallax.git
cd parallax

# Create virtual environment
python3 -m venv ./venv
source ./venv/bin/activate

# Install Parallax for macOS
pip install -e '.[mac]'
```

### 2. Start Parallax with Qwen2.5

```bash
# Start Parallax scheduler (this will download the model on first run)
parallax run -m Qwen/Qwen2.5-7B-Instruct -n 1

# The scheduler will start on http://localhost:3001
# Keep this terminal open!
```

**Note**: First-time model download may take 10-20 minutes depending on your internet speed.

### 3. Set Up Translation Assistant

Open a new terminal:

```bash
# Navigate to the project directory
cd /Users/apple/parralax

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Start the FastAPI backend
uvicorn main:app --reload
```

The backend will start on `http://localhost:8000`

### 4. Open the Frontend

```bash
# Open the frontend in your default browser
open frontend/index.html
```

That's it! 🎉 You're ready to translate.

## 📖 Usage Guide

### Basic Translation

1. Enter or speak text in the **Source** panel
2. Select your target language
3. Click **Translate**
4. View results and metrics in real-time

### Voice Input

1. Click the 🎤 microphone button
2. Allow microphone access when prompted
3. Speak your text (it will be transcribed automatically)
4. Click translate when ready

### Keyboard Shortcuts

- **Ctrl/Cmd + Enter** - Translate current text
- **Click history item** - Load previous translation

### Tips for Best Performance

- Keep text under 1000 characters for fastest results
- Use specific language selection instead of auto-detect for speed
- First translation may be slower as model initializes

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│   (HTML/JS)     │
│   Port: File    │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│  FastAPI Server │
│   Port: 8000    │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│    Parallax     │
│   Scheduler     │
│   Port: 3001    │
└────────┬────────┘
         │
         │ Local Inference
         ▼
┌─────────────────┐
│   Qwen2.5-7B    │
│   (Local MLX)   │
└─────────────────┘
```

## 🔧 API Endpoints

### `GET /`
Health check and Parallax status

### `POST /api/translate`
Translate text
```json
{
  "text": "Hello world",
  "source_lang": "en",
  "target_lang": "es"
}
```

### `GET /api/languages`
Get list of supported languages

### `GET /api/history`
Get recent translation history

### `DELETE /api/history`
Clear translation history

### `GET /api/stats`
Get translation statistics

## 🌍 Supported Languages

English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Russian, Hindi, Turkish, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Greek, Hebrew, Thai, Vietnamese, Indonesian, Malay

## 🎯 Why This Matters

### Privacy First
In an era of data breaches and privacy concerns, this tool ensures your sensitive translations never leave your device. Perfect for:
- Legal documents
- Medical records
- Business confidential information
- Personal communications

### Zero Cost
No API fees, no subscriptions, no usage limits. Run as many translations as you need, completely free.

### Speed & Performance
Optimized prompts and local inference mean:
- Average translation time: **< 2 seconds**
- No internet latency
- Works completely offline

## 🐛 Troubleshooting

### "Parallax Offline" error

**Solution**: Make sure Parallax is running:
```bash
parallax run -m Qwen/Qwen2.5-7B-Instruct -n 1
```

### "Backend Offline" error

**Solution**: Start the FastAPI server:
```bash
cd backend
uvicorn main:app --reload
```

### Voice input not working

**Solution**: 
- Ensure you're using Chrome or Safari (best Web Speech API support)
- Grant microphone permissions when prompted
- Check browser console for errors

### Slow translations (>5 seconds)

**Solution**:
- Ensure no other heavy apps are running
- Try shorter text (< 500 characters)
- Check if model is fully loaded (first translation is slower)

## 📊 Performance Benchmarks

Tested on MacBook Air M1 (8GB RAM):

| Text Length | Avg Time | Language Pair |
|-------------|----------|---------------|
| <100 chars  | 1.2s     | EN → ES       |
| 100-500     | 1.8s     | EN → FR       |
| 500-1000    | 2.5s     | EN → ZH       |
| 1000-2000   | 3.8s     | EN → JA       |

## 🤝 Contributing

This is a competition entry, but feedback and suggestions are welcome! Feel free to:
- Report bugs
- Suggest features
- Share performance results

## 📝 License

MIT License - feel free to use and modify!

## 🙏 Acknowledgments

- **[Gradient](https://gradient.network)** for creating Parallax
- **Build your own AI Lab** competition for the inspiration
- **Qwen Team** for the excellent Qwen2.5 model

## 🔗 Links

- [Parallax GitHub](https://github.com/GradientHQ/parallax)
- [Competition Page](https://gradient.network/campaign/)
- [Gradient Network](https://gradient.network)

---

**Built with ❤️ for the Parallax community**

*Showcasing the power of local, private AI on everyday devices*
