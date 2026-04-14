import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      setSessions(res.data.sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const truncateUrl = (url) => url.replace('https://meet.google.com/', 'meet/');

  const completedCount = sessions.filter(s => s.status === 'done').length;
  const totalTranscripts = sessions.reduce((sum, s) => sum + (s.transcriptCount || 0), 0);

  return (
    <div className="page-container">

      {/* Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your meetings · AI-distilled summaries · Speaker analytics</p>
      </div>

      {/* Stats */}
      {sessions.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: 'var(--space-xl)',
        }}>
          <div className="insight-card">
            <div className="insight-icon">◉</div>
            <div className="insight-value">{sessions.length}</div>
            <div className="insight-label">Sessions</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">✦</div>
            <div className="insight-value">{completedCount}</div>
            <div className="insight-label">Completed</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">❖</div>
            <div className="insight-value">{totalTranscripts}</div>
            <div className="insight-label">Transcript Lines</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">⬡</div>
            <div className="insight-value">Gemini</div>
            <div className="insight-label">AI Engine</div>
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="action-row">
        <div>
          {sessions.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
            </p>
          )}
        </div>
        <Link to="/new" id="btn-new-session" className="btn btn-primary">
          ✦ New Session
        </Link>
      </div>

      {/* Session list */}
      {loading ? (
        <div className="spinner" />
      ) : sessions.length === 0 ? (
        <div className="empty-state glass-card" style={{ border: '1px solid var(--border)' }}>
          <span className="empty-icon">✦</span>
          <h3>No sessions yet</h3>
          <p>Deploy your first AI Scribe to a meeting and watch the words emerge.</p>
          <Link to="/new" id="btn-begin-session" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            ✦ Begin First Session
          </Link>
        </div>
      ) : (
        <div className="session-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map((session, idx) => (
            <Link
              key={session.id}
              to={`/summary/${session.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="session-card-enhanced" style={{ animationDelay: `${idx * 0.06}s` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    ◈ {truncateUrl(session.meetUrl)}
                  </span>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    <span>🕐 {formatDate(session.createdAt)}</span>
                    {session.transcriptCount > 0 && (
                      <span>❖ {session.transcriptCount} lines</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusIndicator status={session.status} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem', opacity: 0.4 }}>›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
