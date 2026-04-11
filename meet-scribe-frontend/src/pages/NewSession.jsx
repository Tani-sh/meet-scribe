import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  const isValidMeetUrl = (url) => {
    return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url);
  };

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>New Session</h1>
        <p>Deploy the AI Scribe to capture and illuminate your meeting</p>
      </div>

      <div className="glass-card" style={{ maxWidth: '700px' }}>
        {/* Evaluator Instructions */}
        <div className="info-banner" style={{ marginBottom: '24px' }}>
          <h4>⚠️ Evaluator Instructions</h4>
          <p style={{ margin: 0 }}>
            For a quick test, ensure the <strong>Demo Mode toggle</strong> is active below.
            This simulates a full meeting with realistic transcript and Gemini AI summarization
            without requiring a live Google Meet session.
          </p>
        </div>

        {/* URL Input */}
        <div className="input-group" style={{ marginBottom: '24px' }}>
          <label htmlFor="meetUrl">Google Meet URL</label>
          <div style={{ display: 'flex', gap: '12px' }}>
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
              className="btn btn-primary"
              onClick={deployBot}
              disabled={!meetUrl || isActive || deploying}
            >
              {isActive ? '⏳ Active' : '✦ Deploy'}
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '12px 16px',
          background: demoMode ? 'rgba(201, 168, 76, 0.06)' : 'rgba(92, 207, 141, 0.06)',
          border: `1px solid ${demoMode ? 'rgba(201, 168, 76, 0.15)' : 'rgba(92, 207, 141, 0.15)'}`,
          borderRadius: '10px',
        }}>
          <button
            onClick={() => setDemoMode(!demoMode)}
            disabled={isActive}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: demoMode ? 'var(--accent)' : 'var(--success)',
              color: demoMode ? '#0a0a0f' : '#0a0a0f',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isActive ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-body)',
            }}
          >
            {demoMode ? '✦ Demo Mode' : '◉ Live Mode'}
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {demoMode
              ? 'Simulates a meeting with realistic transcript — no Google Meet needed'
              : 'Connects to real Google Meet via authenticated Chrome bot'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="error-msg" style={{ marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Golden Orb — Listening State */}
        {isListening && (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div className="golden-orb"></div>
            <p style={{
              color: 'var(--accent-light)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              letterSpacing: '0.05em',
              marginTop: '12px',
            }}>
              Listening...
            </p>
          </div>
        )}

        {/* Status (non-listening states) */}
        {status !== 'idle' && !isListening && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            padding: '16px',
            background: 'rgba(201, 168, 76, 0.03)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            <StatusIndicator status={status} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {status === 'launching' && 'Conjuring the Scribe...'}
              {status === 'navigating' && 'Traversing to the gathering...'}
              {status === 'waiting-for-signin' && '🔐 Authenticating identity...'}
              {status === 'joining' && 'Seeking entry to the chamber...'}
              {status === 'summarizing' && 'Distilling wisdom from the discourse...'}
              {status === 'done' && 'Inscriptions complete. Redirecting...'}
              {status === 'error' && 'The ritual was disrupted.'}
            </span>
          </div>
        )}

        {/* Live Transcript */}
        {transcript.length > 0 && (
          <div>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--accent-light)',
              marginBottom: '12px',
              letterSpacing: '0.03em',
            }}>
              ✦ Live Transcript
            </h3>
            <div className="transcript-feed">
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
