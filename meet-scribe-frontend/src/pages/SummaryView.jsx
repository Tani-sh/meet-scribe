import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SPEAKER_COLORS = ['#6c5ce7', '#00d2a0', '#ffa726', '#40c4ff', '#ff5252', '#e040fb', '#64ffda', '#ff8a65'];

export default function SummaryView() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/summary/${sessionId}`);
      setSession(res.data);
    } catch (err) {
      console.error('Failed to fetch session:', err);
    } finally {
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!session?.summary) return;
    await navigator.clipboard.writeText(session.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSummary = () => {
    if (!session) return;
    const content = `Meeting Summary\n${'='.repeat(50)}\n\nMeet URL: ${session.meetUrl}\nDate: ${new Date(session.createdAt).toLocaleString()}\n\n${session.summary || 'No summary available.'}\n\n${'='.repeat(50)}\nTranscript\n${'='.repeat(50)}\n\n${session.transcript || 'No transcript captured.'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-summary-${sessionId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSummaryHTML = (markdown) => {
    if (!markdown) return '';
    return markdown
      .replace(/## (.*)/g, '<h2>$1</h2>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.*?)\]/g, '<strong>[$1]</strong>');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">❌</div>
          <h3>Session not found</h3>
          <p>This session doesn't exist or has expired.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-flex' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const analytics = session.analytics;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ← Dashboard
          </Link>
        </div>
        <h1>Meeting Summary</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            🔗 {session.meetUrl}
          </span>
          <StatusIndicator status={session.status} />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {new Date(session.createdAt).toLocaleString()}
        </span>
      </div>

      {/* Meeting Insights Cards */}
      {analytics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <div className="insight-card">
            <div className="insight-icon">👥</div>
            <div className="insight-value">{analytics.speakerCount}</div>
            <div className="insight-label">Speakers</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">💬</div>
            <div className="insight-value">{analytics.totalLines}</div>
            <div className="insight-label">Statements</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">📝</div>
            <div className="insight-value">{analytics.totalWords.toLocaleString()}</div>
            <div className="insight-label">Words</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">⏱️</div>
            <div className="insight-value">~{analytics.estimatedDuration}m</div>
            <div className="insight-label">Duration</div>
          </div>
        </div>
      )}

      {/* Speaker Analytics */}
      {analytics && analytics.speakers.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
            📊 Speaker Analytics
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {analytics.speakers.map((speaker, i) => (
              <div key={speaker.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                    {speaker.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {speaker.lines} lines · {speaker.words} words · {speaker.percentage}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.max(speaker.percentage, 3)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}88)`,
                    borderRadius: '4px',
                    transition: 'width 1s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            ✨ AI Summary
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={copySummary}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={downloadSummary}>
              📥 Download
            </button>
          </div>
        </div>

        {session.summary ? (
          <div
            className="summary-content"
            dangerouslySetInnerHTML={{ __html: renderSummaryHTML(session.summary) }}
          />
        ) : session.status === 'summarizing' ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>
              Generating summary with Gemini AI...
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No summary available yet.</p>
        )}
      </div>

      {/* Transcript Accordion */}
      {session.transcript && (
        <div className="accordion">
          <button
            className={`accordion-header ${showTranscript ? 'open' : ''}`}
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <span>📝 Raw Transcript ({session.transcriptCount || 0} entries)</span>
            <span className="arrow">▼</span>
          </button>
          {showTranscript && (
            <div className="accordion-body">
              <div className="transcript-feed" style={{ maxHeight: '500px' }}>
                {session.transcript.split('\n').map((line, i) => (
                  <div key={i} className="transcript-line">{line || ' '}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {session.error && (
        <div className="glass-card" style={{
          marginTop: '24px',
          borderColor: 'rgba(255, 82, 82, 0.2)',
          background: 'rgba(255, 82, 82, 0.05)',
        }}>
          <h3 style={{ color: 'var(--error)', marginBottom: '8px' }}>⚠️ Error</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{session.error}</p>
        </div>
      )}
    </div>
  );
}
