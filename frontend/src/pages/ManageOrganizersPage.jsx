import { useState, useEffect, useMemo } from 'react';
import fuzzy from '../utils/fuzzy';
import { Link } from 'react-router-dom';
import adminService from '../services/adminService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const ManageOrganizersPage = () => {
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    organizerName: '', category: 'technical', description: '', contactEmail: ''
  });
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [activeTab, setActiveTab] = useState('organizers');
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => { loadOrganizers(); }, []);

  const loadOrganizers = async () => {
    try {
      const res = await adminService.getOrganizers({ limit: 200 }); // Fetch all organizers
      setOrganizers(res.organizers || []);
  } catch { /* ignore */ } finally { setLoading(false); }
  };

  const filteredOrganizers = useMemo(() => {
    let list = [...organizers];
    if (searchTerm.trim()) {
      list = list.filter(o =>
        fuzzy.matchesFuzzy(o.organizerName || '', searchTerm) ||
        fuzzy.matchesFuzzy(o.email || '', searchTerm) ||
        fuzzy.matchesFuzzy(o.category || '', searchTerm)
      );
    }
    if (filterCategory) list = list.filter(o => o.category === filterCategory);
    if (filterStatus === 'active') list = list.filter(o => o.isActive);
    if (filterStatus === 'inactive') list = list.filter(o => !o.isActive);
    return list;
  }, [organizers, searchTerm, filterCategory, filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.organizerName) return toast.error('Name required');
    setCreating(true);
    try {
      const res = await adminService.createOrganizer(form);
      const email = res.organizer?.email || 'email sent';
      const tmp = res.organizer?.temporaryPassword || res.generatedPassword || null;
      toast.success(`Organizer created! Email: ${email}`);
      // show a credentials modal so admin can copy the temp password
      setCreatedCredentials({ email, password: tmp });
      setShowModal(false);
      setForm({ organizerName: '', category: 'technical', description: '', contactEmail: '' });
      loadOrganizers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setCreating(false); }
  };

  const handleToggle = async (id) => {
    try {
      await adminService.toggleOrganizerStatus(id);
      toast.success('Status updated');
      loadOrganizers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    // kept for backward compatibility, but prefer modal flow
    if (!confirm('Permanently delete this organizer? This cannot be undone.')) return;
    try {
      await adminService.deleteOrganizer(id, true); // Pass true for permanent deletion
      toast.success('Organizer permanently deleted');
      loadOrganizers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // New: explicit archive/permanent-delete modal flow
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  const handleArchive = async (id) => {
    try {
      await adminService.deleteOrganizer(id, false); // archive (deactivate)
      toast.success('Organizer archived (deactivated)');
      setConfirmDelete(null);
      loadOrganizers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePermanentDelete = async (id) => {
    try {
      await adminService.deleteOrganizer(id, true);
      toast.success('Organizer permanently deleted');
      setConfirmDelete(null);
      loadOrganizers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleResetPassword = async (id) => {
    try {
      const res = await adminService.resetOrganizerPassword(id);
      toast.success(`New password: ${res.temporaryPassword || res.newPassword || 'Sent via email'}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  useEffect(() => { if (activeTab === 'passwords') loadPasswordRequests(); }, [activeTab]);

  const loadPasswordRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await adminService.getPasswordResetRequests();
      const list = res.requests || res || [];
      setPasswordRequests(list.map(r => ({
        _id: r._id,
        organizerName: r.organizer?.organizerName || r.organizerName || (r.organizer && r.organizer.name) || 'Organizer',
        email: r.organizer?.email || r.email || (r.organizer && r.organizer.email) || '',
        passwordResetRequestDate: r.requestedAt || r.passwordResetRequestDate || r.requestedAt
      })));
    } catch (err) {
      console.error(err);
    } finally { setLoadingRequests(false); }
  };

  const handleActionRequest = async (reqId, action) => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      await adminService.actionPasswordResetRequest(reqId, action);
      toast.success(`Request ${action}d`);
      loadPasswordRequests();
      loadOrganizers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const categories = [...new Set(organizers.map(o => o.category).filter(Boolean))];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h3>Admin Panel</h3>
        </div>
        <nav className="sidebar-nav">
          <Link to="/dashboard" className="sidebar-item">
            <span className="sidebar-icon">{'\u{1F4CA}'}</span><span>Overview</span>
          </Link>
          <button className="sidebar-item active">
            <span className="sidebar-icon">{'\u{1F3E2}'}</span><span>Organizers</span>
          </button>
          <Link to="/password-requests" className="sidebar-item">
            <span className="sidebar-icon">{'\u{1F511}'}</span><span>Password Resets</span>
          </Link>
        </nav>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-topbar">
          <h2 className="dashboard-title">{'\u{1F3E2}'} Manage Organizers</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Organizer</button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="filter-bar">
          <div className="dashboard-search" style={{ flex: 1 }}>
            <span className="search-icon-inner">{'\u{1F50D}'}</span>
            <input type="text" placeholder="Search organizers by name, email..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="form-control search-input" />
          </div>
          <select className="form-control filter-select" value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-control filter-select" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
          </select>
        </div>

        {filteredOrganizers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{'\u{1F3E2}'}</div>
            <h3>No organizers found</h3>
            <p className="text-muted">{searchTerm || filterCategory || filterStatus ? 'Try adjusting your filters' : 'Add your first organizer to get started!'}</p>
          </div>
        ) : (
          <div className="org-grid">
            {filteredOrganizers.map(org => (
              <div key={org._id} className="org-manage-card">
                <div className="org-manage-header">
                  <div className="org-manage-avatar">
                    {(org.organizerName || '?')[0].toUpperCase()}
                  </div>
                  <div className="org-manage-info">
                    <h4>{org.organizerName}</h4>
                    <p className="text-muted">{org.email}</p>
                  </div>
                  <span className={`badge ${org.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {org.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="org-manage-details">
                  <span className="badge badge-primary">{org.category}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>{org.eventCount || 0} events</span>
                </div>
                <div className="org-manage-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(org._id)}>
                    {org.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(org._id)}>
                    Reset PW
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ id: org._id, name: org.organizerName })}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
          {activeTab === 'organizers' && (
            filteredOrganizers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{'\u{1F3E2}'}</div>
                <h3>No organizers found</h3>
                <p className="text-muted">{searchTerm || filterCategory || filterStatus ? 'Try adjusting your filters' : 'Add your first organizer to get started!'}</p>
              </div>
            ) : (
              <div className="org-grid">
                {filteredOrganizers.map(org => (
                  <div key={org._id} className="org-manage-card">
                    <div className="org-manage-header">
                      <div className="org-manage-avatar">
                        {(org.organizerName || '?')[0].toUpperCase()}
                      </div>
                      <div className="org-manage-info">
                        <h4>{org.organizerName}</h4>
                        <p className="text-muted">{org.email}</p>
                      </div>
                      <span className={`badge ${org.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {org.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="org-manage-details">
                      <span className="badge badge-primary">{org.category}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{org.eventCount || 0} events</span>
                    </div>
                    <div className="org-manage-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(org._id)}>
                        {org.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(org._id)}>
                        Reset PW
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(org._id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'passwords' && (
            <div style={{ padding: 12 }}>
              <h3>Password Reset Requests</h3>
              {loadingRequests ? <LoadingSpinner /> : passwordRequests.length === 0 ? (
                <p className="text-muted">No password reset requests</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Organizer</th><th>Email</th><th>Requested At</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {passwordRequests.map(r => (
                        <tr key={r._id}>
                          <td>{r.organizerName}</td>
                          <td>{r.email}</td>
                          <td>{new Date(r.passwordResetRequestDate).toLocaleString()}</td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleActionRequest(r._id, 'approve')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleActionRequest(r._id, 'reject')}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Organizer</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Organizer Name *</label>
                <input className="form-control" value={form.organizerName}
                  onChange={e => setForm(f => ({ ...f, organizerName: e.target.value }))} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Email will be auto-generated as: {form.organizerName ? `${form.organizerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-iiit@clubs.iiit.ac.in` : 'name-iiit@clubs.iiit.ac.in'}
                </p>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="technical">Technical</option>
                  <option value="cultural">Cultural</option>
                  <option value="sports">Sports</option>
                  <option value="literary">Literary</option>
                  <option value="gaming">Gaming</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input type="email" className="form-control" value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
              A password will be auto-generated and shown after creation.
            </p>
          </div>
        </div>
      )}
      {createdCredentials && (
        <div className="modal-overlay" onClick={() => setCreatedCredentials(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Organizer Created</h2>
            <p style={{ fontSize: 14 }}>
              Email: <strong>{createdCredentials.email}</strong>
            </p>
            <p style={{ fontSize: 14 }}>
              Temporary password: <code style={{ fontFamily: 'monospace', padding: '4px 6px' }}>{createdCredentials.password || 'Sent via email'}</code>
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(createdCredentials.email || '');
                toast.success('Email copied');
              }}>Copy Email</button>
              <button className="btn btn-secondary" onClick={() => {
                if (!createdCredentials.password) return toast.error('No password available');
                navigator.clipboard.writeText(createdCredentials.password);
                toast.success('Password copied');
              }}>Copy Password</button>
              <button className="btn btn-secondary" onClick={() => setCreatedCredentials(null)}>Close</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>Note: the temporary password will also be emailed to the organizer. Encourage them to reset it on first login.</p>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Remove Organizer</h2>
            <p>Choose how to remove <strong>{confirmDelete.name}</strong>:</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => handleArchive(confirmDelete.id)}>Archive (Deactivate)</button>
              <button className="btn btn-danger" onClick={() => handlePermanentDelete(confirmDelete.id)}>Permanently Delete</button>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Archiving will deactivate the account and prevent login. Permanent deletion will remove the organizer and cascade-delete their events and registrations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageOrganizersPage;
