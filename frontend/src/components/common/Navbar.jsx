import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import notificationService from '../../services/notificationService';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  // Poll unread count every 15s
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetch = () => notificationService.getUnreadCount().then(r => setUnreadCount(r.count)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 15000);
    return () => clearInterval(iv);
  }, [isAuthenticated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNotifications = async () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen) {
      setNotifLoading(true);
      try {
        const res = await notificationService.getNotifications({ limit: 20 });
        setNotifications(res.notifications || []);
      } catch { /* ignore */ }
      finally { setNotifLoading(false); }
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.read) {
      notificationService.markAsRead([notif._id]).catch(() => {});
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
    }
    setNotifOpen(false);
    if (notif.link) navigate(notif.link);
  };

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

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  return (
    <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

        {/* Notification Bell */}
        {isAuthenticated && (
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button className="notif-bell" onClick={openNotifications}
              title="Notifications"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
                position: 'relative', padding: '4px 8px', transition: 'transform 0.2s'
              }}>
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  background: 'var(--danger)', color: '#fff',
                  borderRadius: '50%', width: 18, height: 18,
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'notifPulse 2s ease-in-out infinite'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {notifOpen && (
              <div className="notif-dropdown" style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                width: 360, maxHeight: 440,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                zIndex: 999, overflow: 'hidden',
                animation: 'modalIn 0.2s ease'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="btn-link" style={{ fontSize: 12 }} onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifLoading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n._id} onClick={() => handleNotifClick(n)}
                        style={{
                          padding: '12px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          background: n.read ? 'transparent' : 'rgba(108,92,231,0.06)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,92,231,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(108,92,231,0.06)'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, marginBottom: 2 }}>
                              {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginRight: 6, verticalAlign: 'middle' }} />}
                              {n.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {n.message}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
