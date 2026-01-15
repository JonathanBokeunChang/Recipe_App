# Installation Guide - Recipe 2

Complete dependency installation guide for the Video-to-Recipe application.

---

## System Requirements

✅ **Already Installed:**
- Node.js v25.2.1
- npm v11.6.2

---

## Installation Steps

### 1. Install System Dependencies (Required)

#### Install yt-dlp (Video Downloader)
```bash
# Using Homebrew (recommended)
brew install yt-dlp

# OR using pip
pip install yt-dlp

# Verify installation
yt-dlp --version
```

**Purpose**: Downloads TikTok videos for processing

---

### 2. Install Mobile App Dependencies (React Native)

```bash
cd apps/mobile
npm install
```

**What this installs:**
- ✅ Expo SDK (~54.0.31)
- ✅ React Native (0.81.5)
- ✅ React 19.1.0
- ✅ Expo Router (navigation)
- ✅ React Native Reanimated (animations)
- ✅ TypeScript
- ✅ All other React Native dependencies

**Time**: ~2-3 minutes

---

### 3. Install API Server Dependencies (Backend)

```bash
cd services/api
npm install
```

**Already installed packages:**
- ✅ @google/generative-ai (^0.24.1) - Gemini SDK
- ✅ express (^4.19.2) - Web server
- ✅ cors (^2.8.5) - CORS middleware
- ✅ dotenv (^16.4.5) - Environment variables
- ✅ nanoid (^5.0.7) - ID generation
- ✅ openai (^4.85.2) - Kept for potential future use

**Time**: Already installed, ~0 seconds

---

### 4. Configure Environment Variables

```bash
cd services/api
# Edit .env file and add your Gemini API key
```

**Get your Gemini API key:**
1. Visit: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)

**Update `.env`:**
```bash
GEMINI_API_KEY=AIzaSy...your-actual-key...
GEMINI_MODEL=gemini-1.5-flash
```

---

## Optional Dependencies

### ffmpeg (NOT Required for Gemini Pipeline)

**Status**: ❌ Not installed (not needed for current Gemini pipeline)

If you want to add it anyway for future features:
```bash
brew install ffmpeg
```

**Note**: The old OpenAI pipeline needed ffmpeg for audio extraction and frame sampling. The new Gemini pipeline doesn't need it because Gemini handles video natively.

---

## Verification

### Test API Server
```bash
cd services/api
npm start
```

Expected output:
```
[server] listening on http://localhost:4000
```

### Test Mobile App
```bash
cd apps/mobile
npm start
```

Expected output:
```
› Metro waiting on exp://...
› Scan the QR code above with Expo Go (Android) or Camera app (iOS)
```

### Test Video Download (yt-dlp)
```bash
yt-dlp --version
```

Expected: Version number (e.g., `2024.12.23`)

---

## Quick Start Commands

```bash
# Terminal 1: Start API server
cd services/api
npm start

# Terminal 2: Start mobile app
cd apps/mobile
npm start
```

---

## Dependency Summary

### Node.js Packages

**Mobile App** (`apps/mobile/package.json`):
- Total dependencies: 20+
- Install with: `cd apps/mobile && npm install`

**API Server** (`services/api/package.json`):
- Total dependencies: 6
- Status: ✅ Already installed

### System Tools

| Tool | Required? | Status | Install Command |
|------|-----------|--------|-----------------|
| **yt-dlp** | ✅ Yes | ❌ Not installed | `brew install yt-dlp` |
| **ffmpeg** | ❌ No | ❌ Not installed | `brew install ffmpeg` (optional) |
| **Node.js** | ✅ Yes | ✅ v25.2.1 | Already installed |
| **npm** | ✅ Yes | ✅ v11.6.2 | Already installed |

---

## Troubleshooting

### "yt-dlp: command not found"
```bash
brew install yt-dlp
```

### "Cannot find module '@google/generative-ai'"
```bash
cd services/api
npm install
```

### "GEMINI_API_KEY is missing"
Edit `services/api/.env` and add your API key from https://aistudio.google.com/app/apikey

### Mobile app won't start
```bash
cd apps/mobile
rm -rf node_modules
npm install
npm start
```

---

## What's Next?

1. ✅ Install yt-dlp: `brew install yt-dlp`
2. ✅ Install mobile dependencies: `cd apps/mobile && npm install`
3. ✅ Add Gemini API key to `services/api/.env`
4. ✅ Test the pipeline with a TikTok video!

---

## Architecture Overview

```
Mobile App (React Native + Expo)
    ↓ HTTP requests
API Server (Node.js + Express)
    ↓ Uses
yt-dlp (downloads TikTok videos)
    ↓ Video file sent to
Gemini API (analyzes video natively)
    ↓ Returns
Recipe JSON
```

**No longer needed:**
- ❌ ffmpeg (audio extraction)
- ❌ Whisper (transcription)
- ❌ tesseract (OCR)

All handled natively by Gemini! 🎉
