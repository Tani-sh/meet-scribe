/**
 * Session Manager — In-memory session store with local file persistence
 * Manages session lifecycle: joining → listening → summarizing → done → error
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SUMMARIES_DIR = path.join(DATA_DIR, 'summaries');

// Ensure directories exist
[DATA_DIR, TRANSCRIPTS_DIR, SUMMARIES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// In-memory session store
const sessions = new Map();

function createSession(sessionId, meetUrl) {
  const session = {
    id: sessionId,
    meetUrl,
    status: 'joining', // joining | listening | summarizing | done | error
    transcript: [],
    summary: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function getAllSessions() {
  return Array.from(sessions.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function updateStatus(sessionId, status) {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
    session.updatedAt = new Date().toISOString();
  }
  return session;
}

function appendTranscript(sessionId, text) {
  const session = sessions.get(sessionId);
  if (session) {
    session.transcript.push({
      text,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();
  }
  return session;
}

function setSummary(sessionId, summary) {
  const session = sessions.get(sessionId);
  if (session) {
    session.summary = summary;
    session.status = 'done';
    session.updatedAt = new Date().toISOString();
    // Persist to local filesystem
    saveToFile(sessionId, session);
  }
  return session;
}

function setError(sessionId, error) {
  const session = sessions.get(sessionId);
  if (session) {
    session.error = error;
    session.status = 'error';
    session.updatedAt = new Date().toISOString();
  }
  return session;
}

function saveToFile(sessionId, session) {
  try {
    // Save transcript
    const transcriptText = session.transcript.map(t => t.text).join('\n');
    fs.writeFileSync(
      path.join(TRANSCRIPTS_DIR, `${sessionId}.txt`),
      transcriptText,
      'utf-8'
    );

    // Save summary + metadata
    const summaryData = {
      sessionId,
      meetUrl: session.meetUrl,
      summary: session.summary,
      createdAt: session.createdAt,
      completedAt: session.updatedAt,
    };
    fs.writeFileSync(
      path.join(SUMMARIES_DIR, `${sessionId}.json`),
      JSON.stringify(summaryData, null, 2),
      'utf-8'
    );

    console.log(`💾 Session ${sessionId} saved to disk`);
  } catch (err) {
    console.error(`Failed to save session ${sessionId}:`, err.message);
  }
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  updateStatus,
  appendTranscript,
  setSummary,
  setError,
};
