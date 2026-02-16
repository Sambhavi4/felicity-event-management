import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const getNavLinks = () => {
    if (!isAuthenticated) return null;

    if (user?.role === 'participant') {
      return (
        <>
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/events" className={isActive('/events')}>Browse Events</Link>
          <Link to="/clubs" className={isActive('/clubs')}>Clubs/Organizers</Link>
          <Link to="/teams" className={isActive('/teams')}>My Teams</Link>
          <Link to="/profile" className={isActive('/profile')}>Profile</Link>
        </>
      );
    }

    if (user?.role === 'organizer') {
      return (
        <>
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/create-event" className={isActive('/create-event')}>Create Event</Link>
          <Link to="/events" className={isActive('/events')}>Ongoing Events</Link>
          <Link to="/profile" className={isActive('/profile')}>Profile</Link>
        </>
      );
    }

    if (user?.role === 'admin') {
      return (
        <>
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/manage-organizers" className={isActive('/manage-organizers')}>Organizers</Link>
          <Link to="/password-requests" className={isActive('/password-requests')}>Password Resets</Link>
          <Link to="/events" className={isActive('/events')}>Browse Events</Link>
        </>
      );
    }
    return null;
  };

  return (
    <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Topbar brand removed — sidebar will show the logo instead */}
        <div className="nav-links">
          {!isAuthenticated && (
            <>
              <Link to="/events" className={isActive('/events')}>Browse Events</Link>
              <Link to="/clubs" className={isActive('/clubs')}>Clubs</Link>
            </>
          )}
          {getNavLinks()}
        </div>
      </div>
      <div className="nav-right">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {isAuthenticated ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
              {user?.firstName || user?.organizerName || 'Admin'}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login"><button className="btn btn-secondary btn-sm">Login</button></Link>
            <Link to="/register"><button className="btn btn-primary btn-sm">Register</button></Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
