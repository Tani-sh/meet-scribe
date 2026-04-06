/**
 * Server — Express + Socket.IO API for Google Meet AI Scribe
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const { joinMeet } = require('./bot');
const { joinMeetDemo } = require('./botDemo');
const { summarizeTranscript, extractSpeakerAnalytics } = require('./summarizer');
const sessionManager = require('./sessionManager');
const { saveTranscript, saveSummary } = require('./cloudStorage');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// Rate limiting — prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// ─── Socket.IO ──────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('subscribe', (sessionId) => {
    socket.join(sessionId);
    console.log(`📡 Client ${socket.id} subscribed to session ${sessionId}`);
    // Emit current status to handle race conditions where bot fails immediately
    const session = sessionManager.getSession(sessionId);
    if (session) {
      socket.emit('status', { sessionId, status: session.status, error: session.error });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send('🤖 Meet Scribe API Backend is running. Please use the frontend application to interact.');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deploy bot to a Meet session
app.post('/api/join', async (req, res) => {
  const { meetUrl, demo } = req.body;

  if (!meetUrl) {
    return res.status(400).json({ error: 'meetUrl is required' });
  }

  // Validate Google Meet URL
  const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
  if (!meetRegex.test(meetUrl.split('?')[0])) {
    return res.status(400).json({
      error: 'Invalid Google Meet URL. Expected format: https://meet.google.com/xxx-xxxx-xxx',
    });
  }

  const sessionId = uuidv4();
  const session = sessionManager.createSession(sessionId, meetUrl);

  // Emit initial status
  io.to(sessionId).emit('status', { sessionId, status: 'joining' });

  // Launch bot in background (don't await — it's long-running)
  launchBot(sessionId, meetUrl, !!demo);

  res.json({
    sessionId,
    status: session.status,
    message: 'Bot is joining the meeting...',
  });
});

// Get session status & summary
app.get('/api/summary/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const transcriptText = session.transcript.map(t => t.text).join('\n');
  const analytics = transcriptText ? extractSpeakerAnalytics(transcriptText) : null;

  res.json({
    sessionId: session.id,
    status: session.status,
    meetUrl: session.meetUrl,
    summary: session.summary,
    transcript: transcriptText,
    transcriptCount: session.transcript.length,
    analytics,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    error: session.error,
  });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions().map(s => ({
    id: s.id,
    meetUrl: s.meetUrl,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    hasSummary: !!s.summary,
  }));
  res.json({ sessions });
});

// ─── Bot Launcher ───────────────────────────────────────────────────────────

async function launchBot(sessionId, meetUrl, isDemo = false) {
  const joinFn = isDemo ? joinMeetDemo : joinMeet;
  console.log(`[${sessionId}] Mode: ${isDemo ? '🎭 DEMO' : '🤖 LIVE'}`);

  try {
    await joinFn(meetUrl, {
      onStatus: (status) => {
        sessionManager.updateStatus(sessionId, status);
        io.to(sessionId).emit('status', { sessionId, status });
        console.log(`[${sessionId}] Status: ${status}`);
      },

      onTranscript: (text) => {
        sessionManager.appendTranscript(sessionId, text);
        io.to(sessionId).emit('transcript', { sessionId, text });
      },

      onError: async (error) => {
        console.error(`[${sessionId}] Error: ${error}`);
        sessionManager.setError(sessionId, error);
        io.to(sessionId).emit('status', { sessionId, status: 'error', error });
      },

      onEnd: async () => {
        console.log(`[${sessionId}] Meeting ended, generating summary...`);
        sessionManager.updateStatus(sessionId, 'summarizing');
        io.to(sessionId).emit('status', { sessionId, status: 'summarizing' });

        const session = sessionManager.getSession(sessionId);
        const fullTranscript = session.transcript.map(t => t.text).join('\n');

        if (fullTranscript.trim().length > 0) {
          try {
            const summary = await summarizeTranscript(fullTranscript);
            sessionManager.setSummary(sessionId, summary);
            io.to(sessionId).emit('status', { sessionId, status: 'done' });
            io.to(sessionId).emit('summary', { sessionId, summary });
            console.log(`[${sessionId}] ✅ Summary generated`);

            // Save to cloud/local storage
            await saveTranscript(sessionId, session.transcript);
            await saveSummary(sessionId, summary);
          } catch (err) {
            console.error(`[${sessionId}] Summarization error:`, err.message);
            sessionManager.setError(sessionId, `Summarization failed: ${err.message}`);
            io.to(sessionId).emit('status', { sessionId, status: 'error', error: err.message });
          }
        } else {
          sessionManager.setSummary(sessionId, '## No transcript captured\nThe meeting ended without any captions being detected.');
          io.to(sessionId).emit('status', { sessionId, status: 'done' });
          console.log(`[${sessionId}] ⚠️ No transcript captured`);
        }
      },
    });
  } catch (err) {
    console.error(`[${sessionId}] Fatal error:`, err.message);
    sessionManager.setError(sessionId, err.message);
    io.to(sessionId).emit('status', { sessionId, status: 'error', error: err.message });
  }
}

// ─── Start Server ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🤖 Meet Scribe Backend                 ║
║   Running on http://localhost:${PORT}        ║
║                                           ║
║   AI Engine: Gemini 2.0 Flash             ║
╚═══════════════════════════════════════════╝
  `);
});
