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

    // Demo mode: skip Firebase, just log in
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
      <div className="app-bg"></div>
      <div className="glass-card auth-card">
        <div className="auth-header">
          <span className="auth-icon">🤖</span>
          <h1 className="auth-title">Meet Scribe</h1>
          <p className="auth-subtitle">
            {isDemoMode
              ? 'Demo Mode — click Sign In to continue'
              : isSignup ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {isDemoMode && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(108, 92, 231, 0.1)',
            border: '1px solid rgba(108, 92, 231, 0.2)',
            borderRadius: '8px',
            color: 'var(--accent-light)',
            fontSize: '0.8rem',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
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
            {loading ? '...' : isDemoMode ? '🚀 Enter Demo' : isSignup ? 'Create Account' : 'Sign In'}
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
