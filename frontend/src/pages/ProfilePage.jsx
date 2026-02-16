import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    contactNumber: user?.contactNumber || '',
    collegeName: user?.collegeName || '',
    description: user?.description || '',
    contactEmail: user?.contactEmail || '',
    contactNumber2: user?.contactNumber || '',
    organizerName: user?.organizerName || '',
    category: user?.category || '',
    discordWebhook: user?.discordWebhook || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showResetRequestForm, setShowResetRequestForm] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [editInterests, setEditInterests] = useState(false);
  const [interests, setInterests] = useState(user?.interests || []);
  const [followedOrgs, setFollowedOrgs] = useState([]);

  const allInterests = ['Technology', 'Music', 'Dance', 'Drama', 'Art', 'Sports', 'Literature', 'Photography', 'Gaming', 'Robotics', 'Coding', 'Debate', 'Quiz', 'Film', 'Design', 'Entrepreneurship'];

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setLoading(true);
    try {
      let _res;
      if (user.role === 'organizer') {
        _res = await userService.updateOrganizerProfile({
          organizerName: form.organizerName,
          category: form.category,
          description: form.description,
          contactEmail: form.contactEmail,
          contactNumber: form.contactNumber2,
          discordWebhook: form.discordWebhook,
        });
      } else {
        _res = await userService.updateProfile({
          firstName: form.firstName,
          lastName: form.lastName,
          contactNumber: form.contactNumber,
          collegeName: form.collegeName,
        });
      }
      updateUser((_res || {}).user);
      toast.success('Profile updated');
      setEditing(false);
    } catch (_err) {
      toast.error(_err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterests = async () => {
    try {
      const _res = await userService.updateInterests(interests);
      updateUser({ ...user, interests });
      toast.success('Interests updated');
      setEditInterests(false);
    } catch (_err) {
      toast.error(_err.response?.data?.message || 'Failed');
    }
  };

  // Fetch full organizer objects for followed organizers so user can unfollow from profile
  useEffect(() => {
    let mounted = true;
    const loadFollowed = async () => {
      if (user?.role !== 'participant') return;
      try {
        const _res = await userService.getFollowedOrganizers();
        if (!mounted) return;
        setFollowedOrgs(_res.organizers || _res || []);
      } catch {
        // silent
      }
    };
    loadFollowed();
    return () => { mounted = false; };
  }, [user?.role]);

  const handleUnfollow = async (organizerId) => {
    try {
      const _res = await userService.unfollowOrganizer(organizerId);
      // Update local list
      setFollowedOrgs(prev => prev.filter(o => o._id !== organizerId && o.id !== organizerId));
      // Update auth user followed list if available
      if (user) {
        const updated = { ...user, followedOrganizers: (user.followedOrganizers || []).filter(id => String(id) !== String(organizerId)) };
        updateUser(updated);
      }
      toast.success('Unfollowed');
    } catch (_err) {
      toast.error(_err.response?.data?.message || 'Failed to unfollow');
    }
  };

  const toggleInterest = (interest) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast.error('Passwords do not match');
    if (passwords.newPassword.length < 6) return toast.error('Min 6 characters');
    try {
      await authService.updatePassword(passwords.currentPassword, passwords.newPassword);
      toast.success('Password updated');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch {
      toast.error('Failed');
    }
  };

  const handleRequestReset = async () => {
    try {
      await userService.requestPasswordReset(resetReason);
      toast.success('Password reset requested. Admin will review it.');
      setShowResetRequestForm(false);
      setResetReason('');
      } catch {
        // silent
      }
  };

  return (
    <div className="container" style={{ maxWidth: 700 }}>
      <h1 style={{ marginBottom: 24 }}>Profile</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3>Personal Information</h3>
          {!editing && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>}
        </div>

        {/* Non-editable fields */}
        <div className="form-group">
          <label>Email (cannot be changed)</label>
          <input className="form-control" value={user?.email || ''} disabled />
        </div>
        <div className="form-group">
          <label>Role</label>
          <input className="form-control" value={user?.role || ''} disabled />
        </div>
        {user?.role === 'participant' && (
          <div className="form-group">
            <label>Participant Type</label>
            <input className="form-control" value={user?.participantType || ''} disabled />
          </div>
        )}
        {/* Do not display participant type (IIIT/non-IIIT) prominently to avoid confusion; admin manages any restrictions */}

        {/* Participant editable fields */}
        {user?.role === 'participant' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>First Name</label>
                <input name="firstName" className="form-control" value={form.firstName}
                  onChange={handleChange} disabled={!editing} />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input name="lastName" className="form-control" value={form.lastName}
                  onChange={handleChange} disabled={!editing} />
              </div>
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input name="contactNumber" className="form-control" value={form.contactNumber}
                onChange={handleChange} disabled={!editing} />
            </div>
            <div className="form-group">
              <label>College / Organization Name</label>
              <input name="collegeName" className="form-control" value={form.collegeName}
                onChange={handleChange} disabled={!editing} />
            </div>
          </>
        )}

        {/* Organizer editable fields (spec 10.5) */}
        {user?.role === 'organizer' && (
          <>
            <div className="form-group">
              <label>Organizer Name</label>
              <input name="organizerName" className="form-control" value={form.organizerName}
                onChange={handleChange} disabled={!editing} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select name="category" className="form-control" value={form.category}
                onChange={handleChange} disabled={!editing}>
                <option value="technical">Technical</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="literary">Literary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea name="description" className="form-control" value={form.description}
                onChange={handleChange} disabled={!editing} rows={4} />
            </div>
            <div className="form-group">
              <label>Contact Email</label>
              <input name="contactEmail" className="form-control" value={form.contactEmail}
                onChange={handleChange} disabled={!editing} />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input name="contactNumber2" className="form-control" value={form.contactNumber2}
                onChange={handleChange} disabled={!editing} />
            </div>
            <div className="form-group">
              <label>Discord Webhook URL <span style={{fontSize:11,color:'var(--text-muted)'}}>(auto-posts new events to Discord)</span></label>
              <input name="discordWebhook" className="form-control" value={form.discordWebhook}
                onChange={handleChange} disabled={!editing}
                placeholder="https://discord.com/api/webhooks/..." />
            </div>
          </>
        )}

        {editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Interests (spec 9.6: editable from profile) */}
      {user?.role === 'participant' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3>Interests</h3>
            {!editInterests ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditInterests(true)}>Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveInterests}>Save</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditInterests(false); setInterests(user?.interests || []); }}>Cancel</button>
              </div>
            )}
          </div>
          {editInterests ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allInterests.map(i => (
                <button key={i} className={`interest-chip ${interests.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(i)}>{i}</button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(user?.interests || []).length > 0 ? user.interests.map(i => (
                <span key={i} className="badge badge-primary">{i}</span>
              )) : <p className="text-muted" style={{ fontSize: 13 }}>No interests selected yet</p>}
            </div>
          )}
        </div>
      )}

      {/* Followed clubs (spec 9.6: editable from profile) */}
      {user?.role === 'participant' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginBottom: 12 }}>Followed Clubs</h3>
            <a href="/clubs" className="btn btn-link">Manage on Clubs page</a>
          </div>

          {followedOrgs.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>You are not following any clubs yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {followedOrgs.map(o => (
                <div key={o._id || o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{o.organizerName || o.name || o.organizer}</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.category}</div>
                  </div>
                  <div>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleUnfollow(o._id || o.id)}>Unfollow</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Password */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Security</h3>
          {user?.role === 'participant' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(!showPasswordForm)}>
              Change Password
            </button>
          )}
          {user?.role === 'organizer' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowResetRequestForm(!showResetRequestForm)}>
              Request Password Reset
            </button>
          )}
        </div>

        {showResetRequestForm && user?.role === 'organizer' && (
          <div style={{ marginTop: 16 }}>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Your request will be sent to the admin for review. Please provide a reason.
            </p>
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea className="form-control" value={resetReason}
                onChange={e => setResetReason(e.target.value)}
                placeholder="e.g., Forgot password, need a reset..." rows={2} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleRequestReset}>Submit Request</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowResetRequestForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} style={{ marginTop: 16 }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" className="form-control" value={passwords.currentPassword}
                onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-control" value={passwords.newPassword}
                onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" className="form-control" value={passwords.confirmPassword}
                onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
