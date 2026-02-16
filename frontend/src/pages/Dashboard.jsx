import { useState, useEffect, useMemo } from 'react';
import fuzzy from '../utils/fuzzy';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import eventService from '../services/eventService';
import registrationService from '../services/registrationService';
import adminService from '../services/adminService';
import EventCard from '../components/common/EventCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

/* ===================== PARTICIPANT DASHBOARD ===================== */
const ParticipantDashboard = () => {
  const [tab, setTab] = useState('upcoming');
  const [registrations, setRegistrations] = useState([]);
  const [browseEvents, setBrowseEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingMap, setUploadingMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) setTab(hash);
  }, []);

  useEffect(() => { loadRegistrations(); }, [tab]);

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tab === 'upcoming') params.upcoming = 'true';
      if (tab === 'normal') params.type = 'normal';
      if (tab === 'merchandise') params.type = 'merchandise';
      if (tab === 'completed') params.status = 'attended';
      if (tab === 'cancelled') params.status = 'cancelled';
      const res = await registrationService.getMyRegistrations(params);
      let regs = res.registrations || [];
      if (tab === 'merchandise') regs = regs.filter(r => r.registrationType === 'merchandise');
      if (tab === 'normal') regs = regs.filter(r => r.registrationType === 'normal');
      setRegistrations(regs);
          if (regs.length === 0) {
  try {
          // Prefer personalized recommendations when available
          const recRes = await eventService.getRecommendations(8);
          let recs = recRes.events || [];
          if (!recs || recs.length === 0) {
            const evRes = await eventService.getEvents({ page: 1, limit: 8 });
            recs = evRes.events || [];
          }
          setBrowseEvents(recs);
  } catch { /* ignore rec fetch errors */ }
      }
  } catch (_err) { console.error('Failed to load registrations', _err); } finally { setLoading(false); }
  };

  const filteredRegs = useMemo(() => {
    if (!searchTerm.trim()) return registrations;
    return registrations.filter(r =>
      fuzzy.matchesFuzzy(r.event?.name || '', searchTerm) ||
      fuzzy.matchesFuzzy(r.ticketId || '', searchTerm) ||
      fuzzy.matchesFuzzy(r.event?.organizer?.organizerName || '', searchTerm)
    );
  }, [registrations, searchTerm]);

  const sidebarItems = [
    { key: 'upcoming', label: 'Upcoming', icon: '\u{1F4C5}' },
    { key: 'normal', label: 'Events', icon: '\u{1F3AF}' },
    { key: 'merchandise', label: 'Merchandise', icon: '\u{1F6CD}\uFE0F' },
    { key: 'completed', label: 'Completed', icon: '\u2705' },
    { key: 'cancelled', label: 'Cancelled', icon: '\u274C' },
    { key: 'all', label: 'All', icon: '\u{1F4CB}' }
  ];

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h3>My Dashboard</h3>
        </div>
        <nav className="sidebar-nav">
          {sidebarItems.map(item => (
            <button key={item.key}
              className={`sidebar-item ${tab === item.key ? 'active' : ''}`}
              onClick={() => setTab(item.key)}>
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <h2 className="dashboard-title">
            {sidebarItems.find(i => i.key === tab)?.icon}{' '}
            {sidebarItems.find(i => i.key === tab)?.label} Registrations
          </h2>
          <div className="dashboard-search">
            <span className="search-icon-inner">{'\u{1F50D}'}</span>
            <input type="text" placeholder="Search events, tickets..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="form-control search-input" />
          </div>
        </div>
        {loading ? <LoadingSpinner /> : filteredRegs.length === 0 ? (
          <div>
            <div className="empty-state">
              <div className="empty-icon">{'\u{1F4ED}'}</div>
              <h3>No registrations found</h3>
              <p className="text-muted">Explore upcoming events below!</p>
            </div>
            {browseEvents.length > 0 && (
              <>
                <h3 style={{ margin: '24px 0 16px', fontSize: 16, fontWeight: 700 }}>Discover Events</h3>
                <div className="grid grid-3">
                  {browseEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="reg-grid">
            {filteredRegs.map(reg => (
              <div key={reg._id} className="reg-card">
                  <div className="reg-card-header">
                    <div className="reg-card-info">
                      <h4>{reg.event?.name || 'Event'}</h4>
                      <p className="text-muted">by {reg.event?.organizer?.organizerName || 'Organizer'}</p>
                    </div>
                    <span className={`badge ${reg.status === 'confirmed' ? 'badge-success' : reg.status === 'attended' ? 'badge-info' : reg.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {reg.status}
                    </span>
                  </div>
                  <div className="reg-card-meta">
                    <span className="reg-meta-item"><code>{reg.ticketId}</code></span>
                    <span className={`badge ${reg.registrationType === 'merchandise' ? 'badge-success' : 'badge-primary'}`}>
                      {reg.registrationType}
                    </span>
                  </div>
                  {reg.registrationType === 'merchandise' && reg.variantDetails && (
                    <p className="reg-variant">{reg.variantDetails.name} x{reg.quantity} {'\u2014'} {'\u20B9'}{reg.totalAmount}</p>
                  )}
                  {reg.event?.eventStartDate && (
                    <p className="reg-date">{'\u{1F4C5}'} {new Date(reg.event.eventStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                      {/* If merchandise and pending or rejected, don't show View Ticket (no QR yet) */}
                      {reg.registrationType === 'merchandise' && (reg.status === 'pending' || reg.status === 'rejected') ? (
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ticket/${reg._id}`)}>Complete Payment</button>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ticket/${reg._id}`)}>View Ticket</button>
                      )}

                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${reg.event?._id || reg.event}`)}>View Event</button>

                      {/* Payment status badge for merchandise (only show when payment is relevant) */}
                      {reg.registrationType === 'merchandise' && reg.paymentStatus && reg.paymentStatus !== 'not_required' && (
                        <span className={`badge ${reg.paymentStatus === 'pending' ? 'badge-warning' : reg.paymentStatus === 'approved' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 12 }}>
                          {reg.paymentStatus}
                        </span>
                      )}

                      {/* Inline upload removed: participants should upload from their Ticket page. */}

                      {/* Show Feedback button if the event is completed or ended */}
                      {((reg.event?.status && ['completed','closed'].includes(reg.event.status)) || (reg.event?.eventEndDate && new Date() > new Date(reg.event.eventEndDate))) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${reg.event?._id || reg.event}#feedback`)}>Feedback</button>
                      )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

/* ===================== ORGANIZER DASHBOARD ===================== */
const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsEvent, setAnalyticsEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsParticipants, setAnalyticsParticipants] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [activeSection, setActiveSection] = useState('events');
  const navigate = useNavigate();

  useEffect(() => {
    eventService.getMyEvents({ limit: 100 })
      .then(res => setEvents(res.events || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: events.length,
    published: events.filter(e => e.status === 'published').length,
    draft: events.filter(e => e.status === 'draft').length,
    completed: events.filter(e => e.status === 'completed').length,
    totalRegs: events.reduce((sum, e) => sum + (e.registrationCount || 0), 0),
  };

  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (searchTerm.trim()) {
      list = list.filter(e =>
        fuzzy.matchesFuzzy(e.name || '', searchTerm) ||
        fuzzy.matchesFuzzy(e.description || '', searchTerm)
      );
    }
    if (filterStatus) list = list.filter(e => e.status === filterStatus);
    if (filterType) list = list.filter(e => e.eventType === filterType);
    return list;
  }, [events, searchTerm, filterStatus, filterType]);

  const normalizeAnalytics = (a) => {
    if (a.registrationsByStatus && !a.statusBreakdown) a.statusBreakdown = a.registrationsByStatus;
    if (Array.isArray(a.registrationTrend)) {
      // Build a lookup from API data
      const lookup = {};
      a.registrationTrend.forEach(d => { lookup[d.date || d._id] = d.count ?? 0; });
      // Fill in all 30 days so the chart is continuous
      const filled = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - i);
        const key = dt.toISOString().slice(0, 10);
        filled.push({ _id: key, count: lookup[key] || 0 });
      }
      a.registrationTrend = filled;
    }
    return a;
  };

  const loadOrgAnalytics = async () => {
    try {
      const res = await eventService.getOrganizerAnalytics();
      const a = normalizeAnalytics(res.analytics || {});
      setAnalytics(a);
      setAnalyticsEvent({ name: 'All Events' });
      setActiveSection('analytics');
      setAnalyticsParticipants(null);
    } catch { /* ignore */ }
  };

  const loadAnalytics = async (eventId) => {
    try {
      const res = await eventService.getEventAnalytics(eventId);
      const a = normalizeAnalytics(res.analytics || {});
      setAnalytics(a);
      setAnalyticsEvent(res.event);
      setActiveSection('analytics');
      try {
        const regsRes = await registrationService.getEventRegistrations(eventId, { limit: 200 });
        setAnalyticsParticipants(regsRes.registrations || []);
      } catch {
        setAnalyticsParticipants([]);
      }
    } catch { /* ignore analytics errors */ }
  };

  // Auto-load organizer-wide analytics when Analytics section is opened
  useEffect(() => {
    if (activeSection === 'analytics' && !analytics) {
      loadOrgAnalytics();
    }
  }, [activeSection]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h3>Organizer</h3>
        </div>
        <nav className="sidebar-nav">
          <button className={`sidebar-item ${activeSection === 'events' ? 'active' : ''}`}
            onClick={() => setActiveSection('events')}>
            <span className="sidebar-icon">{'\u{1F3AA}'}</span><span>My Events</span>
          </button>
          <button className={`sidebar-item ${activeSection === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSection('analytics')}>
            <span className="sidebar-icon">{'\u{1F4CA}'}</span><span>Analytics</span>
          </button>
          <Link to="/create-event" className="sidebar-item sidebar-cta">
            <span className="sidebar-icon">{'\u2795'}</span><span>Create Event</span>
          </Link>
        </nav>
        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{stats.total}</span>
            <span className="sidebar-stat-lbl">Total</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{stats.published}</span>
            <span className="sidebar-stat-lbl">Live</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-val">{stats.totalRegs}</span>
            <span className="sidebar-stat-lbl">Regs</span>
          </div>
        </div>
      </aside>
      <main className="dashboard-main">
        {activeSection === 'events' && (
          <>
            <div className="dashboard-topbar">
              <h2 className="dashboard-title">{'\u{1F3AA}'} My Events</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="dashboard-search">
                  <span className="search-icon-inner">{'\u{1F50D}'}</span>
                  <input type="text" placeholder="Search events..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)} className="form-control search-input" />
                </div>
                <select className="form-control filter-select" value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
                <select className="form-control filter-select" value={filterType}
                  onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="normal">Normal</option>
                  <option value="merchandise">Merchandise</option>
                </select>
              </div>
            </div>
            <div className="grid grid-4" style={{ marginBottom: 28 }}>
              {[
                { label: 'Total Events', value: stats.total, icon: '\u{1F4E6}' },
                { label: 'Published', value: stats.published, icon: '\u{1F7E2}' },
                { label: 'Drafts', value: stats.draft, icon: '\u{1F4DD}' },
                { label: 'Completed', value: stats.completed, icon: '\u{1F3C1}' }
              ].map(s => (
                <div key={s.label} className="stat-card-v2">
                  <div className="stat-card-icon">{s.icon}</div>
                  <div>
                    <div className="stat-value-v2">{s.value}</div>
                    <div className="stat-label-v2">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {filteredEvents.length > 0 ? (
              <div className="events-carousel">
                {filteredEvents.map(ev => (
                  <div key={ev._id} className="org-event-card">
                    <div className="org-event-badges">
                      <span className={`badge ${ev.eventType === 'merchandise' ? 'badge-success' : 'badge-primary'}`}>{ev.eventType}</span>
                      <span className={`badge ${ev.status === 'published' ? 'badge-info' : ev.status === 'draft' ? 'badge-warning' : ev.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>{ev.status}</span>
                      {ev.eligibility && ev.eligibility !== 'all' && (
                        <span className="badge badge-warning" style={{ marginLeft: 6 }}>{ev.eligibility === 'iiit-only' ? 'IIIT Only' : 'Non-IIIT Only'}</span>
                      )}
                    </div>
                    <h4 className="org-event-name">{ev.name}</h4>
                    <p className="org-event-regs">
                      {ev.registrationCount || 0}{ev.registrationLimit ? `/${ev.registrationLimit}` : ''} registrations
                    </p>
                    <div className="org-event-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/events/${ev._id}`)}>View</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/edit-event/${ev._id}`)}>Edit</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/event-registrations/${ev._id}`)}>Regs</button>
                      {(ev.status === 'completed' || ev.status === 'published') && (
                        <button className="btn btn-primary btn-sm" onClick={() => loadAnalytics(ev._id)}>{'\u{1F4CA}'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">{'\u{1F3AA}'}</div>
                <h3>No events {searchTerm || filterStatus || filterType ? 'match your filters' : 'yet'}</h3>
                <p className="text-muted">
                  {!searchTerm && !filterStatus && !filterType
                    ? 'Create your first event to get started!'
                    : 'Try adjusting your search or filters'}
                </p>
                {!searchTerm && !filterStatus && !filterType && (
                  <Link to="/create-event"><button className="btn btn-primary" style={{ marginTop: 12 }}>+ Create Event</button></Link>
                )}
              </div>
            )}
          </>
        )}
        {activeSection === 'analytics' && analytics && analyticsEvent && (
          <div>
            <div className="dashboard-topbar">
              <h2 className="dashboard-title">{'\u{1F4CA}'} Analytics: {analyticsEvent.name}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-control filter-select" value={analyticsEvent?.id || 'all'}
                  onChange={e => { const v = e.target.value; if (v === 'all') loadOrgAnalytics(); else loadAnalytics(v); }}>
                  <option value="all">All Events</option>
                  {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => { setAnalytics(null); setAnalyticsEvent(null); setActiveSection('events'); }}>{'\u2190'} Back</button>
              </div>
            </div>
            <div className="grid grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: 'Registrations', value: analytics.totalRegistrations || 0, icon: '\u{1F4DD}' },
                { label: 'Attended', value: analytics.attendance?.attended || 0, icon: '\u2705' },
                { label: 'Revenue', value: `\u20B9${analytics.revenue || 0}`, icon: '\u{1F4B0}' },
                { label: 'Views', value: analytics.views || 0, icon: '\u{1F441}\uFE0F' }
              ].map(s => (
                <div key={s.label} className="stat-card-v2">
                  <div className="stat-card-icon">{s.icon}</div>
                  <div>
                    <div className="stat-value-v2">{s.value}</div>
                    <div className="stat-label-v2">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Registration Trend Chart */}
            {analytics.registrationTrend && analytics.registrationTrend.length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}>📈 Registration Trend (Last 30 Days)</h3>
                {(() => {
                  const data = analytics.registrationTrend;
                  const totalRegs = data.reduce((s, d) => s + d.count, 0);
                  if (totalRegs === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: 14 }}>No registrations in the last 30 days</p>
                      </div>
                    );
                  }
                  const W = 700, H = 200, padL = 40, padR = 16, padT = 20, padB = 36;
                  const chartW = W - padL - padR, chartH = H - padT - padB;
                  const maxCount = Math.max(...data.map(d => d.count), 1);
                  // round up y-axis max to a nice number
                  const niceMax = maxCount <= 5 ? 5 : Math.ceil(maxCount / 5) * 5;
                  const xStep = chartW / Math.max(data.length - 1, 1);

                  const points = data.map((d, i) => ({
                    x: padL + i * xStep,
                    y: padT + chartH - (d.count / niceMax) * chartH,
                    ...d
                  }));

                  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

                  // Y-axis ticks (5 ticks)
                  const yTicks = Array.from({ length: 6 }, (_, i) => Math.round((niceMax / 5) * i));

                  // X-axis labels — show ~7 evenly spaced dates
                  const labelInterval = Math.max(1, Math.floor(data.length / 6));

                  return (
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block', margin: '0 auto' }}>
                        <defs>
                          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary-color, #667eea)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--primary-color, #667eea)" stopOpacity="0.03" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines + Y labels */}
                        {yTicks.map(t => {
                          const y = padT + chartH - (t / niceMax) * chartH;
                          return (
                            <g key={t}>
                              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="var(--border-color, #e2e8f0)" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '4,3'} />
                              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted, #94a3b8)" fontFamily="system-ui, sans-serif">{t}</text>
                            </g>
                          );
                        })}

                        {/* Area */}
                        <path d={areaPath} fill="url(#trendGrad)" />

                        {/* Line */}
                        <path d={linePath} fill="none" stroke="var(--primary-color, #667eea)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Data points */}
                        {points.map((p, i) => p.count > 0 && (
                          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--primary-color, #667eea)" stroke="#fff" strokeWidth="2">
                            <title>{`${p._id}: ${p.count} registration${p.count !== 1 ? 's' : ''}`}</title>
                          </circle>
                        ))}

                        {/* X-axis date labels */}
                        {points.map((p, i) => i % labelInterval === 0 || i === points.length - 1 ? (
                          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-muted, #94a3b8)" fontFamily="system-ui, sans-serif">
                            {p._id?.slice(5).replace('-', '/')}
                          </text>
                        ) : null)}
                      </svg>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Status Breakdown */}
            {analytics.statusBreakdown && Object.keys(analytics.statusBreakdown).length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Registration Status Breakdown</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                    <div key={status} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{count}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participants table */}
            {analyticsParticipants && (
              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 12 }}>Participants ({analyticsParticipants.length})</h3>
                {analyticsParticipants.length === 0 ? (
                  <p className="text-muted">No registrations yet.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {analyticsParticipants.map(r => (
                          <tr key={r._id}>
                            <td>{r.participant?.firstName} {r.participant?.lastName}</td>
                            <td>{r.participant?.email}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.ticketId}</td>
                            <td>{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeSection === 'analytics' && !analytics && (
          <div className="empty-state">
            <div className="empty-icon">{'\u{1F4CA}'}</div>
            <h3>Select an event to view analytics</h3>
            <p className="text-muted">Go to My Events and click the chart button on any event</p>
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setActiveSection('events')}>{'\u2190'} Go to Events</button>
          </div>
        )}
      </main>
    </div>
  );
};

/* ===================== ADMIN DASHBOARD ===================== */
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentRegs, setRecentRegs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats()
      .then(res => {
        setStats(res.stats);
        setRecentRegs(res.recentRegistrations || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  // Parse nested stats safely
  const totalOrganizers = stats?.users?.organizers ?? stats?.totalOrganizers ?? 0;
  const activeOrganizers = stats?.users?.activeOrganizers ?? 0;
  const totalEvents = stats?.events?.total ?? stats?.totalEvents ?? 0;
  const publishedEvents = stats?.events?.published ?? 0;
  const totalParticipants = stats?.users?.participants ?? stats?.totalParticipants ?? 0;
  const totalRegistrations = stats?.registrations?.total ?? stats?.totalRegistrations ?? 0;
  const eventsByStatus = stats?.events?.byStatus ?? {};

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h3>Admin Panel</h3>
        </div>
        <nav className="sidebar-nav">
          <button className="sidebar-item active">
            <span className="sidebar-icon">{'\u{1F4CA}'}</span><span>Overview</span>
          </button>
          <Link to="/manage-organizers" className="sidebar-item">
            <span className="sidebar-icon">{'\u{1F3E2}'}</span><span>Organizers</span>
          </Link>
          <Link to="/password-requests" className="sidebar-item">
            <span className="sidebar-icon">{'\u{1F511}'}</span><span>Password Resets</span>
          </Link>
        </nav>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <h2 className="dashboard-title">{'\u{1F4CA}'} System Overview</h2>
        </div>
        <div className="grid grid-4" style={{ marginBottom: 28 }}>
          {[
            { label: 'Organizers', value: totalOrganizers, sub: `${activeOrganizers} active`, icon: '\u{1F3E2}', color: 'var(--accent)' },
            { label: 'Events', value: totalEvents, sub: `${publishedEvents} published`, icon: '\u{1F3AA}', color: 'var(--accent-pink)' },
            { label: 'Participants', value: totalParticipants, sub: 'registered users', icon: '\u{1F465}', color: 'var(--accent-cyan)' },
            { label: 'Registrations', value: totalRegistrations, sub: 'total bookings', icon: '\u{1F3AB}', color: 'var(--accent-gold)' }
          ].map(s => (
            <div key={s.label} className="stat-card-v2 stat-card-glow" style={{ '--glow-color': s.color }}>
              <div className="stat-card-icon">{s.icon}</div>
              <div>
                <div className="stat-value-v2">{s.value}</div>
                <div className="stat-label-v2">{s.label}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(eventsByStatus).length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Events by Status</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(eventsByStatus).map(([status, count]) => (
                <div key={status} className="mini-stat">
                  <span className={`badge ${status === 'published' ? 'badge-info' : status === 'draft' ? 'badge-warning' : status === 'completed' ? 'badge-success' : 'badge-primary'}`}>
                    {status}
                  </span>
                  <strong style={{ marginLeft: 6 }}>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
        {recentRegs.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Recent Registrations</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Participant</th><th>Event</th><th>Date</th></tr></thead>
                <tbody>
                  {recentRegs.map(r => (
                    <tr key={r._id}>
                      <td>{r.participant?.firstName} {r.participant?.lastName}</td>
                      <td>{r.event?.name || 'N/A'}</td>
                      <td>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grid grid-2" style={{ marginTop: 24 }}>
          <Link to="/manage-organizers" className="quick-action-card">
            <div className="quick-action-icon">{'\u{1F3E2}'}</div>
            <div>
              <h3>Manage Clubs/Organizers</h3>
              <p className="text-muted">Add, edit, remove or disable clubs</p>
            </div>
          </Link>
          <Link to="/password-requests" className="quick-action-card">
            <div className="quick-action-icon">{'\u{1F511}'}</div>
            <div>
              <h3>Password Reset Requests</h3>
              <p className="text-muted">Review and approve organizer requests</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

/* ===================== MAIN DASHBOARD ===================== */
const Dashboard = () => {
  const { user } = useAuth();
  if (!user) return <LoadingSpinner />;
  if (user.role === 'participant') return <ParticipantDashboard />;
  if (user.role === 'organizer') return <OrganizerDashboard />;
  if (user.role === 'admin') return <AdminDashboard />;
  return <div className="container"><p>Unknown role</p></div>;
};

export default Dashboard;
