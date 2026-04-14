import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_MESSAGES = {
  launching:          'Conjuring the Scribe from the aether...',
  navigating:         'Traversing to the gathering...',
  'waiting-for-signin': '🔐 Authenticating identity...',
  joining:            'Seeking entry to the chamber...',
  listening:          'Listening and capturing...',
  summarizing:        'Distilling wisdom from the discourse...',
  done:               'Inscriptions complete — redirecting...',
  error:              'The ritual was disrupted.',
};

export default function NewSession() {
  const [meetUrl, setMeetUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [sessionId, setSessionId] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const socketRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isValidMeetUrl = (url) =>
    /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url);

  const deployBot = async () => {
    if (!isValidMeetUrl(meetUrl)) {
      setError('Please enter a valid Google Meet URL (e.g., https://meet.google.com/abc-defg-hij)');
      return;
    }

    setError('');
    setDeploying(true);
    setTranscript([]);

    try {
      const res = await axios.post(`${API_URL}/api/join`, { meetUrl, demo: demoMode });
      const { sessionId: sid } = res.data;
      setSessionId(sid);
      setStatus('joining');

      const socket = io(API_URL);
      socketRef.current = socket;

      socket.on('connect', () => { socket.emit('subscribe', sid); });

      socket.on('status', (data) => {
        if (data.sessionId === sid) {
          setStatus(data.status);
          if (data.status === 'done') navigate(`/summary/${sid}`);
          if (data.status === 'error') {
            setError(data.error || 'An error occurred');
            setDeploying(false);
          }
        }
      });

      socket.on('transcript', (data) => {
        if (data.sessionId === sid) {
          setTranscript((prev) => [...prev, data.text]);
        }
      });

      socket.on('summary', (data) => {
        if (data.sessionId === sid) navigate(`/summary/${sid}`);
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deploy bot. Is the backend running?');
      setDeploying(false);
    }
  };

  const isActive = ['joining', 'launching', 'navigating', 'waiting-for-signin', 'listening', 'summarizing'].includes(status);
  const isListening = status === 'listening';
  const isSummarizing = status === 'summarizing';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>New Session</h1>
        <p>Deploy the AI Scribe to capture and illuminate your meeting</p>
      </div>

      <div className="glass-card" style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Evaluator instructions */}
        <div className="info-banner" style={{ marginBottom: '24px' }}>
          <h4>⚡ Quick Test Instructions</h4>
          <p style={{ margin: 0 }}>
            Enable <strong>Demo Mode</strong> below, paste any Google Meet URL, and click Deploy.
            You'll get a realistic simulated transcript + Gemini AI summary — no live meeting required.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className={`mode-toggle-container ${demoMode ? 'demo-mode' : 'live-mode'}`}>
          <div className="mode-pill">
            <button
              className={`mode-pill-btn ${demoMode ? 'active-demo' : ''}`}
              onClick={() => !isActive && setDemoMode(true)}
              disabled={isActive}
              id="btn-demo-mode"
            >
              ✦ Demo
            </button>
            <button
              className={`mode-pill-btn ${!demoMode ? 'active-live' : ''}`}
              onClick={() => !isActive && setDemoMode(false)}
              disabled={isActive}
              id="btn-live-mode"
            >
              ◉ Live
            </button>
          </div>
          <p className="mode-description">
            {demoMode
              ? 'Simulates a realistic meeting with AI-generated transcript. No Google Meet needed.'
              : 'Connects to real Google Meet via authenticated Chrome bot (requires backend access).'}
          </p>
        </div>

        {/* URL Input */}
        <div className="input-group" style={{ marginBottom: '20px' }}>
          <label htmlFor="meetUrl">Google Meet URL</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              id="meetUrl"
              className="input"
              type="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              disabled={isActive}
              style={{ flex: 1 }}
            />
            <button
              id="btn-deploy"
              className="btn btn-primary"
              onClick={deployBot}
              disabled={!meetUrl || isActive || deploying}
              style={{ flexShrink: 0 }}
            >
              {isActive ? '⏳ Active' : '✦ Deploy'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-msg" id="deploy-error" style={{ marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Summarizing progress */}
        {isSummarizing && (
          <div style={{ marginBottom: '20px' }}>
            <div className="progress-bar"><div className="progress-fill" /></div>
          </div>
        )}

        {/* Status strip */}
        {status !== 'idle' && !isListening && (
          <div className="status-strip" id="status-strip">
            <StatusIndicator status={status} />
            <span className="status-message">
              {STATUS_MESSAGES[status] || status}
            </span>
          </div>
        )}

        {/* Golden Orb — Listening */}
        {isListening && (
          <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <div className="golden-orb" id="listening-orb" />
            <p style={{
              color: 'var(--accent-light)',
              fontSize: '0.88rem',
              fontFamily: 'var(--font-heading)',
              fontStyle: 'italic',
              letterSpacing: '0.06em',
              marginTop: '8px',
            }}>
              Listening to the discourse…
            </p>
          </div>
        )}

        {/* Live Transcript */}
        {transcript.length > 0 && (
          <div id="transcript-container">
            <div className="section-divider"><span>Live Transcript</span></div>
            <div className="transcript-feed" id="transcript-feed">
              {transcript.map((line, i) => (
                <div key={i} className="transcript-line">{line}</div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
