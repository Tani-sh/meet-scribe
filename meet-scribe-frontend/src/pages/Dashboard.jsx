import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateUrl = (url) => {
    return url.replace('https://meet.google.com/', 'meet/');
  };

  const completedCount = sessions.filter(s => s.status === 'done').length;
  const totalTranscripts = sessions.reduce((sum, s) => sum + (s.transcriptCount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your meeting sessions and AI-generated summaries</p>
      </div>

      {/* Stats Bar */}
      {sessions.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: 'var(--space-xl)',
        }}>
          <div className="insight-card">
            <div className="insight-icon">📋</div>
            <div className="insight-value">{sessions.length}</div>
            <div className="insight-label">Sessions</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">✅</div>
            <div className="insight-value">{completedCount}</div>
            <div className="insight-label">Completed</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">💬</div>
            <div className="insight-value">{totalTranscripts}</div>
            <div className="insight-label">Total Lines</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">🤖</div>
            <div className="insight-value">Gemini</div>
            <div className="insight-label">AI Engine</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
        <Link to="/new" className="btn btn-primary">
          ✨ New Session
        </Link>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No sessions yet</h3>
          <p>Deploy your first AI Scribe bot to a Google Meet session to get started.</p>
          <Link to="/new" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-flex' }}>
            🤖 Start First Session
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map((session) => (
            <Link
              key={session.id}
              to={`/summary/${session.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="session-card-enhanced">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    🔗 {truncateUrl(session.meetUrl)}
                  </span>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>{formatDate(session.createdAt)}</span>
                    {session.transcriptCount > 0 && (
                      <span>💬 {session.transcriptCount} lines</span>
                    )}
                  </div>
                </div>
                <StatusIndicator status={session.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
