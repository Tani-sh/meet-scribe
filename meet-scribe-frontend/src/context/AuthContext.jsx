import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

// Demo mode: skip Firebase if no valid config is provided
const isDemoMode = () => {
  const key = import.meta.env.VITE_FIREBASE_API_KEY;
  return !key || key === 'your_firebase_api_key' || key === 'demo-api-key';
};

const DEMO_USER = {
  email: 'demo@meetscribe.local',
  uid: 'demo-user-001',
  displayName: 'Demo User',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      // Auto-login in demo mode
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    if (isDemoMode()) {
      setUser(null);
      return;
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const demoLogin = (email) => {
    if (isDemoMode()) {
      setUser({ ...DEMO_USER, email });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, isDemoMode: isDemoMode(), demoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
