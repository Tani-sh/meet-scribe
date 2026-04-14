import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  // Derive initials for avatar
  const initials = user.email
    ? user.email.charAt(0).toUpperCase()
    : '?';

  return (
    <nav className="navbar">
      {/* Brand */}
      <NavLink to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
        <span className="brand-icon">✦</span>
        <div>
          <span className="brand-name">AI Scribe</span>
          <span className="brand-sub">Meet Intelligence</span>
        </div>
      </NavLink>

      {/* Nav Links */}
      <div className="navbar-nav">
        <NavLink
          to="/"
          end
          id="nav-dashboard"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span>⬡</span>
          <span>Dashboard</span>
        </NavLink>
        <NavLink
          to="/new"
          id="nav-new-session"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span>✦</span>
          <span>New Session</span>
        </NavLink>
      </div>

      {/* Right side */}
      <div className="navbar-right">
        <div className="user-pill">
          <div className="user-avatar" title={user.email}>{initials}</div>
          <span className="user-email-text">{user.email}</span>
        </div>
        <button
          id="btn-logout"
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          title="Sign Out"
        >
          ↩ Sign Out
        </button>
      </div>
    </nav>
  );
}
