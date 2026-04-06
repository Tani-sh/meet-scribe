# 🤖 Google Meet AI Scribe

**Live Demo**: [https://meet-scribe.netlify.app](https://meet-scribe.netlify.app)
*(Features real Firebase Authentication and AI summarizations via Google Gemini 2.0!)*

AI-powered Google Meet transcription and summarization. Deploy a bot to join your meeting, capture the conversation in real-time, and generate intelligent summaries using Gemini AI.

## ✨ Features

- **Live Transcript Capture** — Real-time transcript streaming via WebSocket
- **AI Summarization** — Gemini 2.0 Flash generates structured summaries with action items
- **Demo Mode** — Simulated meeting with realistic multi-speaker transcript for demos
- **Speaker Analytics** — AI tracks speakers, counts words/lines, and estimates duration
- **Premium Dark UI** — Glassmorphism design with animations and responsive layout
- **Cloud Storage** — Transcripts and summaries stored in GCP Cloud Storage (or local files)
- **User Authentication** — Firebase Auth with demo mode bypass for local testing

## 🏗️ Architecture

```
┌─────────────────────────┐        ┌───────────────────────────────┐
│   Frontend (React)       │        │   Backend (Express)            │
│   - Vite + React         │◄──────►│   - Socket.IO (real-time)      │
│   - Firebase Auth        │  REST  │   - Puppeteer Bot (Chrome)     │
│   - Glassmorphism UI     │  + WS  │   - Gemini AI Summarizer       │
│   - Host: Netlify        │        │   - GCP Cloud Storage          │
└─────────────────────────┘        │   - Host: Render               │
                                    └───────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Gemini API key (free) from [aistudio.google.com](https://aistudio.google.com)

### 1. Clone & Install

```bash
# Backend
cd meet-scribe-backend
npm install
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# Frontend
cd ../meet-scribe-frontend
npm install
```

### 2. Configure Environment

**Backend `.env`:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 3. Run Locally

```bash
# Terminal 1 — Backend
cd meet-scribe-backend && node server.js

# Terminal 2 — Frontend
cd meet-scribe-frontend && npm run dev
```

Open http://localhost:5173

## 🎭 Demo Mode vs Live Mode

| Feature | Demo Mode | Live Mode |
|---------|-----------|-----------|
| Transcript | Simulated 4-speaker meeting | Real Google Meet captions |
| Chrome | Not needed | Opens visible Chrome |
| Google account | Not needed | Sign-in required |
| Use case | Demos, portfolio | Actual meetings |

**Demo Mode** streams a realistic sprint planning meeting with 4 participants, demonstrating the full pipeline (capture → AI summarize → display).

## 🤖 How GenAI Was Used

1. **Gemini 2.0 Flash API** — Powered the backend summarization. Generates structured meeting summaries (executive summary, key points, action items, decisions) from raw transcripts.
2. **AI Speaker Analytics** — Created algorithms to parse transcript data, matching speakers to their word counts and calculating engagement percentages.
3. **Puppeteer Stealth** — Anti-detection for browser automation to navigate Google Meets.
4. **Architecture Design** — GenAI assisted with system design, component structure, and debugging across the React frontend and Express backend.

## 📡 Deployment (Monorepo)

### Frontend → Netlify
1. Connect your GitHub repository (`Tani-sh/meet-scribe`) to Netlify.
2. Set the **Base directory** to `meet-scribe-frontend`.
3. Set the **Publish directory** to `meet-scribe-frontend/dist` and build command to `npm run build`.
4. Set env var: `VITE_API_URL=https://meet-scribe-backend.onrender.com`

### Backend → Render
1. Connect your GitHub repository (`Tani-sh/meet-scribe`) to Render as a Web Service.
2. Set the **Root Directory** to `meet-scribe-backend`.
3. Set env vars: `GEMINI_API_KEY`, `FRONTEND_URL=https://meet-scribe.netlify.app`, `NODE_ENV=production`

> **Note:** Render free tier doesn't support Puppeteer/Chrome. The hosted backend uses Demo Mode for bot deployment. Live Mode with real Meet integration works flawlessly when running the backend locally.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite, React, Socket.IO Client |
| Backend | Express, Socket.IO, Puppeteer |
| AI | Gemini 2.0 Flash |
| Auth | Firebase Authentication |
| Storage | GCP Cloud Storage, Local FS |
| Styling | Vanilla CSS (Glassmorphism) |
| Hosting | Netlify (FE), Render (BE) |

## 📁 Project Structure

```
meet-scribe-backend/
├── server.js          # Express + Socket.IO API
├── bot.js             # Puppeteer Meet bot (live mode)
├── botDemo.js         # Simulated transcript (demo mode)
├── summarizer.js      # Ollama → Gemini → fallback chain
├── cloudStorage.js    # GCP Cloud Storage + local fallback
├── sessionManager.js  # In-memory + file session management
├── login.js           # One-time Google sign-in helper
└── data/              # Local storage (transcripts, summaries)

meet-scribe-frontend/
├── src/
│   ├── App.jsx        # Router + Auth provider
│   ├── pages/         # Dashboard, NewSession, Summary, Login
│   ├── components/    # StatusIndicator, ProtectedRoute
│   ├── context/       # AuthContext (Firebase + demo mode)
│   └── index.css      # Design system (dark glassmorphism)
└── netlify.toml       # Netlify deployment config
```

## 📜 License

MIT
