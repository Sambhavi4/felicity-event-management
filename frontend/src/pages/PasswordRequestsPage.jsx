import { useState, useEffect, useMemo } from 'react';
import fuzzy from '../utils/fuzzy';
import adminService from '../services/adminService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const PasswordRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [resetDocs, setResetDocs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [rejectComments, setRejectComments] = useState({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqRes, histRes] = await Promise.all([
        adminService.getPasswordResetRequests(),
        adminService.getPasswordResetHistory()
      ]);
      setRequests(reqRes.requests || []);
      const allHistory = histRes.history || [];
      setResetDocs(allHistory.filter(d => d.status === 'Pending'));
      setHistory(allHistory.filter(d => d.status !== 'Pending'));
  } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleAction = async (docId, action) => {
    const comment = rejectComments[docId] || '';
    if (action === 'reject' && !comment.trim()) {
      return toast.error('Please provide a reason for rejection');
    }
    try {
      const res = await adminService.actionPasswordResetRequest(docId, action, comment);
      toast.success(res.message || `Request ${action}d`);
      if (action === 'approve' && res.temporaryPassword) {
        toast.success(`New password: ${res.temporaryPassword}`, { duration: 10000 });
      }
      setRejectComments(prev => { const n = { ...prev }; delete n[docId]; return n; });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  // Fallback: direct reset for organizers without PasswordReset doc
  const handleDirectReset = async (id) => {
    try {
      const res = await adminService.resetOrganizerPassword(id);
      toast.success(`Password reset! New: ${res.temporaryPassword || res.newPassword || 'Sent via email'}`);
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // Merge pending requests from User model flag with PasswordReset docs
  const pendingItems = useMemo(() => {
    const items = [];
    // Add PasswordReset docs (pending)
    for (const doc of resetDocs) {
      items.push({
        type: 'doc',
        _id: doc._id,
        organizerName: doc.organizer?.organizerName || 'Unknown',
        email: doc.organizer?.email || '',
        reason: doc.reason || '',
        date: doc.createdAt,
        organizerId: doc.organizer?._id
      });
    }
    // Add User-flag based requests that don't have a matching PasswordReset doc
    for (const req of requests) {
      const alreadyInDocs = resetDocs.some(d => d.organizer?._id === req._id || d.organizer === req._id);
      if (!alreadyInDocs) {
        items.push({
          type: 'user',
          _id: req._id,
          organizerName: req.organizerName || 'Unknown',
          email: req.email || '',
          reason: '',
          date: req.passwordResetRequestDate,
          organizerId: req._id
        });
      }
    }
    return items;
  }, [requests, resetDocs]);

  const filteredPending = useMemo(() => {
    if (!searchTerm.trim()) return pendingItems;
    return pendingItems.filter(r =>
      fuzzy.matchesFuzzy(r.organizerName, searchTerm) ||
      fuzzy.matchesFuzzy(r.email, searchTerm)
    );
  }, [pendingItems, searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    return history.filter(r =>
      fuzzy.matchesFuzzy(r.organizer?.organizerName || '', searchTerm) ||
      fuzzy.matchesFuzzy(r.organizer?.email || '', searchTerm)
    );
  }, [history, searchTerm]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="page-header-row">
        <h1>Password Reset Requests</h1>
        <span className="badge badge-info" style={{ fontSize: 14, padding: '6px 16px' }}>
          {pendingItems.length} pending
        </span>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          Pending ({pendingItems.length})
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          History ({history.length})
        </button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 24 }}>
        <div className="dashboard-search" style={{ flex: 1 }}>
          <span className="search-icon-inner">{'\u{1F50D}'}</span>
          <input type="text" placeholder="Search by name or email..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="form-control search-input" />
        </div>
      </div>

      {activeTab === 'pending' && (
        <>
          {filteredPending.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{'\u{1F511}'}</div>
              <h3>No pending requests</h3>
              <p className="text-muted">{searchTerm ? 'Try a different search term' : 'All password resets are handled!'}</p>
            </div>
          ) : (
            <div className="org-grid">
              {filteredPending.map(req => (
                <div key={req._id} className="org-manage-card">
                  <div className="org-manage-header">
                    <div className="org-manage-avatar" style={{ background: 'var(--accent-gold)', color: '#000' }}>
                      {'\u{1F511}'}
                    </div>
                    <div className="org-manage-info">
                      <h4>{req.organizerName}</h4>
                      <p className="text-muted">{req.email}</p>
                    </div>
                  </div>
                  <div className="org-manage-details">
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Requested: {req.date ? new Date(req.date).toLocaleString() : 'N/A'}
                    </span>
                    {req.reason && (
                      <p style={{ fontSize: 13, marginTop: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
                        <strong>Reason:</strong> {req.reason}
                      </p>
                    )}
                  </div>
                  {/* Reject comment input */}
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <input type="text" className="form-control" placeholder="Admin comment (required for reject)..."
                      value={rejectComments[req._id] || ''}
                      onChange={e => setRejectComments(prev => ({ ...prev, [req._id]: e.target.value }))} />
                  </div>
                  <div className="org-manage-actions" style={{ display: 'flex', gap: 8 }}>
                    {req.type === 'doc' ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleAction(req._id, 'approve')}>
                          {'\u2705'} Approve & Reset
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleAction(req._id, 'reject')}>
                          {'\u274C'} Reject
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => handleDirectReset(req._id)}>
                        {'\u2705'} Approve & Reset
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{'\u{1F4DC}'}</div>
              <h3>No history yet</h3>
            </div>
          ) : (
            <div className="org-grid">
              {filteredHistory.map(doc => (
                <div key={doc._id} className="org-manage-card">
                  <div className="org-manage-header">
                    <div className="org-manage-avatar" style={{
                      background: doc.status === 'Approved' ? 'var(--success)' : 'var(--danger)',
                      color: '#fff'
                    }}>
                      {doc.status === 'Approved' ? '\u2705' : '\u274C'}
                    </div>
                    <div className="org-manage-info">
                      <h4>{doc.organizer?.organizerName || 'Unknown'}</h4>
                      <p className="text-muted">{doc.organizer?.email || ''}</p>
                    </div>
                    <span className={`badge ${doc.status === 'Approved' ? 'badge-success' : 'badge-danger'}`}>
                      {doc.status}
                    </span>
                  </div>
                  <div className="org-manage-details" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>Requested by: {doc.requestedBy || 'N/A'}</div>
                    {doc.reason && <div>Reason: {doc.reason}</div>}
                    {doc.adminComment && <div>Admin comment: {doc.adminComment}</div>}
                    <div>Date: {new Date(doc.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PasswordRequestsPage;
