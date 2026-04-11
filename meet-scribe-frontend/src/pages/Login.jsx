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

  return (
    <div className="auth-page">
      <div className="app-bg">
        <div className="starfield"></div>
      </div>
      <div className="glass-card auth-card">
        <div className="auth-header">
          {/* Constellation SVG icon */}
          <svg className="auth-icon" width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 16px' }}>
            <circle cx="32" cy="12" r="3" fill="#c9a84c" opacity="0.9"/>
            <circle cx="16" cy="32" r="2.5" fill="#e8d48b" opacity="0.7"/>
            <circle cx="48" cy="32" r="2.5" fill="#e8d48b" opacity="0.7"/>
            <circle cx="24" cy="48" r="2" fill="#c9a84c" opacity="0.8"/>
            <circle cx="40" cy="48" r="2" fill="#c9a84c" opacity="0.8"/>
            <circle cx="32" cy="32" r="4" fill="#c9a84c"/>
            <line x1="32" y1="12" x2="16" y2="32" stroke="#c9a84c" strokeWidth="0.8" opacity="0.4"/>
            <line x1="32" y1="12" x2="48" y2="32" stroke="#c9a84c" strokeWidth="0.8" opacity="0.4"/>
            <line x1="16" y1="32" x2="24" y2="48" stroke="#e8d48b" strokeWidth="0.8" opacity="0.3"/>
            <line x1="48" y1="32" x2="40" y2="48" stroke="#e8d48b" strokeWidth="0.8" opacity="0.3"/>
            <line x1="16" y1="32" x2="32" y2="32" stroke="#c9a84c" strokeWidth="0.8" opacity="0.5"/>
            <line x1="48" y1="32" x2="32" y2="32" stroke="#c9a84c" strokeWidth="0.8" opacity="0.5"/>
            <line x1="24" y1="48" x2="40" y2="48" stroke="#e8d48b" strokeWidth="0.8" opacity="0.3"/>
          </svg>
          <h1 className="auth-title">AI Scribe</h1>
          <p className="auth-subtitle">
            {isDemoMode
              ? 'Demo Mode — click Sign In to continue'
              : isSignup ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {isDemoMode && (
          <div className="info-banner" style={{ marginBottom: '16px', textAlign: 'center' }}>
            🔓 Firebase not configured — running in demo mode. Set up Firebase in <code>.env</code> for real auth.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isDemoMode}
            />
          </div>

          {!isDemoMode && (
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '...' : isDemoMode ? '✦ Enter Demo' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {!isDemoMode && (
          <div className="auth-toggle">
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); }}>
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
