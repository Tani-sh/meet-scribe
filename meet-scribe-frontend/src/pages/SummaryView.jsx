import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import StatusIndicator from '../components/StatusIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SPEAKER_COLORS = [
  '#c9a84c', '#5ccf8d', '#5c9ccf', '#cf5c9c',
  '#e88a5c', '#948ae8', '#64dfc8', '#e8b84c',
];

export default function SummaryView() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchSession(); }, [sessionId]);

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
    setTimeout(() => setCopied(false), 2200);
  };

  const downloadSummary = () => {
    if (!session) return;
    const content = [
      'Meeting Summary',
      '='.repeat(50),
      '',
      `Meet URL: ${session.meetUrl}`,
      `Date: ${new Date(session.createdAt).toLocaleString()}`,
      '',
      session.summary || 'No summary available.',
      '',
      '='.repeat(50),
      'Transcript',
      '='.repeat(50),
      '',
      session.transcript || 'No transcript captured.',
    ].join('\n');

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

  const formatDate = (date) =>
    new Date(date).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div>
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', fontSize: '0.85rem' }}>
            Loading session…
          </p>
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (!session) {
    return (
      <div className="page-container">
        <div className="empty-state glass-card">
          <span className="empty-icon">✦</span>
          <h3>Session not found</h3>
          <p>This session doesn't exist or has expired.</p>
          <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '4px' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const analytics = session.analytics;

  return (
    <div className="page-container">

      {/* Header */}
      <div className="page-header">
        <div className="breadcrumb">
          <Link to="/"><span>⬡</span> Dashboard</Link>
          <span className="breadcrumb-sep">›</span>
          <span>Meeting Summary</span>
        </div>
        <h1>Meeting Inscriptions</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
            ◈ {session.meetUrl}
          </span>
          <StatusIndicator status={session.status} />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block', marginTop: '4px' }}>
          {formatDate(session.createdAt)}
        </span>
      </div>

      {/* Stats grid */}
      {analytics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <div className="insight-card">
            <div className="insight-icon">◉</div>
            <div className="insight-value">{analytics.speakerCount}</div>
            <div className="insight-label">Speakers</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">❖</div>
            <div className="insight-value">{analytics.totalLines}</div>
            <div className="insight-label">Statements</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">✦</div>
            <div className="insight-value">{analytics.totalWords?.toLocaleString()}</div>
            <div className="insight-label">Words</div>
          </div>
          <div className="insight-card">
            <div className="insight-icon">⬡</div>
            <div className="insight-value">~{analytics.estimatedDuration}m</div>
            <div className="insight-label">Duration</div>
          </div>
        </div>
      )}

      {/* Speaker Analytics */}
      {analytics?.speakers?.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '20px' }}>
          <div className="action-row" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="action-row-title">✦ Speaker Analytics</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {analytics.speakers.map((speaker, i) => (
              <div key={speaker.name} className="speaker-row">
                <div className="speaker-meta">
                  <div className="speaker-name">
                    <div
                      className="speaker-dot"
                      style={{ background: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }}
                    />
                    {speaker.name}
                  </div>
                  <div className="speaker-stats">
                    <span className="speaker-stat-item">❖ {speaker.lines} lines</span>
                    <span className="speaker-stat-item">⬡ {speaker.words} words</span>
                    <span className="speaker-stat-item" style={{ color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }}>
                      {speaker.percentage}%
                    </span>
                  </div>
                </div>
                <div className="speaker-bar-track">
                  <div
                    className="speaker-bar-fill"
                    style={{
                      width: `${Math.max(speaker.percentage, 3)}%`,
                      background: `linear-gradient(90deg, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}80)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="tab-bar" id="summary-tabs">
        <button
          id="tab-summary"
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          ✦ AI Summary
        </button>
        {session.transcript && (
          <button
            id="tab-transcript"
            className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcript')}
          >
            ❖ Transcript ({session.transcriptCount || 0})
          </button>
        )}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="glass-card" id="summary-card">
          <div className="action-row" style={{ marginBottom: 'var(--space-lg)' }}>
            <span className="action-row-title">AI-Generated Summary</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="btn-copy-summary"
                className={`btn btn-secondary btn-sm ${copied ? 'copied-anim' : ''}`}
                onClick={copySummary}
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
              <button
                id="btn-download-summary"
                className="btn btn-secondary btn-sm"
                onClick={downloadSummary}
              >
                📥 Download
              </button>
            </div>
          </div>

          {session.summary ? (
            <div
              className="summary-content"
              id="summary-content"
              dangerouslySetInnerHTML={{ __html: renderSummaryHTML(session.summary) }}
            />
          ) : session.status === 'summarizing' ? (
            <div style={{ textAlign: 'center', padding: '36px' }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.88rem' }}>
                Generating summary with Gemini AI…
              </p>
              <div className="progress-bar" style={{ marginTop: '16px', maxWidth: '280px', margin: '16px auto 0' }}>
                <div className="progress-fill" />
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No summary available yet.</p>
          )}
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === 'transcript' && session.transcript && (
        <div className="glass-card" id="transcript-card">
          <div className="action-row" style={{ marginBottom: 'var(--space-md)' }}>
            <span className="action-row-title">Raw Transcript</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {session.transcriptCount || 0} entries
            </span>
          </div>
          <div className="transcript-feed" style={{ maxHeight: '520px' }}>
            {session.transcript.split('\n').map((line, i) => (
              <div key={i} className="transcript-line">{line || '\u00A0'}</div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {session.error && (
        <div className="glass-card" style={{
          marginTop: '24px',
          borderColor: 'rgba(207,92,92,0.25)',
          background: 'rgba(207,92,92,0.04)',
        }}>
          <h3 style={{ color: 'var(--error)', marginBottom: '8px', fontSize: '1rem' }}>⚠️ Error Details</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{session.error}</p>
        </div>
      )}
    </div>
  );
}
