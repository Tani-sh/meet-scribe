import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isDemoMode, demoLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isDemoMode) {
      demoLogin(email || 'demo@meetscribe.local');
      navigate('/');
      return;
    }

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Invalid credentials. Please try again.',
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="app-bg"><div className="starfield" /></div>

      <div className="glass-card auth-card">

        {/* Logo & Title */}
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="12" r="3.5" fill="#c9a84c" opacity="0.95"/>
                <circle cx="16" cy="36" r="2.5" fill="#e8d48b" opacity="0.75"/>
                <circle cx="48" cy="36" r="2.5" fill="#e8d48b" opacity="0.75"/>
                <circle cx="24" cy="52" r="2" fill="#c9a84c" opacity="0.85"/>
                <circle cx="40" cy="52" r="2" fill="#c9a84c" opacity="0.85"/>
                <circle cx="32" cy="32" r="5" fill="#c9a84c"/>
                <line x1="32" y1="12" x2="16" y2="36" stroke="#c9a84c" strokeWidth="0.9" opacity="0.45"/>
                <line x1="32" y1="12" x2="48" y2="36" stroke="#c9a84c" strokeWidth="0.9" opacity="0.45"/>
                <line x1="16" y1="36" x2="24" y2="52" stroke="#e8d48b" strokeWidth="0.9" opacity="0.35"/>
                <line x1="48" y1="36" x2="40" y2="52" stroke="#e8d48b" strokeWidth="0.9" opacity="0.35"/>
                <line x1="16" y1="36" x2="48" y2="36" stroke="#c9a84c" strokeWidth="0.9" opacity="0.5"/>
                <line x1="24" y1="52" x2="40" y2="52" stroke="#e8d48b" strokeWidth="0.9" opacity="0.35"/>
              </svg>
            </div>
          </div>
          <h1 className="auth-title">AI Scribe</h1>
          <p className="auth-subtitle">
            {isDemoMode
              ? 'Demo Mode Active'
              : isSignup ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Demo banner */}
        {isDemoMode && (
          <div className="info-banner" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <span className="demo-badge">🔓 Demo</span>
            {' '}Firebase not configured — click below to enter demo mode.
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} id="auth-form">
          {error && <div className="error-msg" id="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isDemoMode}
              autoComplete="email"
            />
          </div>

          {!isDemoMode && (
            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          <button
            id="btn-auth-submit"
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
          >
            {loading
              ? 'Processing…'
              : isDemoMode
                ? '✦ Enter Demo'
                : isSignup
                  ? '✦ Create Account'
                  : '✦ Sign In'}
          </button>
        </form>

        {!isDemoMode && (
          <>
            <div className="auth-divider" style={{ marginTop: '20px' }}>
              <span>{isSignup ? 'Already have an account?' : 'New here?'}</span>
            </div>
            <div className="auth-toggle">
              <button id="btn-auth-toggle" onClick={switchMode}>
                {isSignup ? 'Sign In instead' : 'Create an account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
