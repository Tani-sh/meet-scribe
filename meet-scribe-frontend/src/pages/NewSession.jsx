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
    return () => {
      socketRef.current?.disconnect();
    };
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

      // Connect to Socket.IO for real-time updates
      const socket = io(API_URL);
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('subscribe', sid);
      });

      socket.on('status', (data) => {
        if (data.sessionId === sid) {
          setStatus(data.status);
          if (data.status === 'done') {
            navigate(`/summary/${sid}`);
          }
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
        if (data.sessionId === sid) {
          navigate(`/summary/${sid}`);
        }
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deploy bot. Is the backend running?');
      setDeploying(false);
    }
  };

  const isActive = ['joining', 'launching', 'navigating', 'waiting-for-signin', 'listening', 'summarizing'].includes(status);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>New Session</h1>
        <p>Deploy the AI Scribe bot to capture and summarize your meeting</p>
      </div>

      <div className="glass-card" style={{ maxWidth: '700px' }}>
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
              {isActive ? '⏳ Active' : '🤖 Deploy'}
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
            background: demoMode ? 'rgba(108, 92, 231, 0.08)' : 'rgba(0, 200, 83, 0.08)',
            border: `1px solid ${demoMode ? 'rgba(108, 92, 231, 0.2)' : 'rgba(0, 200, 83, 0.2)'}`,
            borderRadius: '10px',
          }}>
            <button
              onClick={() => setDemoMode(!demoMode)}
              disabled={isActive}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: demoMode ? 'var(--accent)' : '#00c853',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: isActive ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {demoMode ? '🎭 Demo Mode' : '🤖 Live Mode'}
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {demoMode
                ? 'Simulates a meeting with realistic transcript — no Google Meet needed'
                : 'Connects to real Google Meet via Puppeteer (may be blocked by Google)'}
            </span>
          </div>

        {/* Error */}
        {error && (
          <div className="error-msg" style={{
            padding: '12px 16px',
            background: 'rgba(255, 82, 82, 0.1)',
            border: '1px solid rgba(255, 82, 82, 0.2)',
            borderRadius: '8px',
            color: '#ff5252',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Status */}
        {status !== 'idle' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            padding: '16px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <StatusIndicator status={status} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {status === 'launching' && 'Launching Chrome...'}
              {status === 'navigating' && 'Navigating to Google Meet...'}
              {status === 'waiting-for-signin' && '🔐 Sign into Google in the Chrome window that opened...'}
              {status === 'joining' && 'Bot is joining the meeting...'}
              {status === 'listening' && 'Bot is in the meeting, capturing transcript...'}
              {status === 'summarizing' && 'Meeting ended. Generating AI summary...'}
              {status === 'done' && 'Summary ready! Redirecting...'}
              {status === 'error' && 'Something went wrong.'}
            </span>
          </div>
        )}

        {/* Live Transcript */}
        {transcript.length > 0 && (
          <div>
            <h3 style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '12px',
            }}>
              📝 Live Transcript
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
