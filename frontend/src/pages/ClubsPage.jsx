import { useState, useEffect, useMemo } from 'react';
import fuzzy from '../utils/fuzzy';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const ClubsPage = () => {
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFollowed, setFilterFollowed] = useState('');
  const [followedIds, setFollowedIds] = useState([]);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => { loadOrganizers(); }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'participant') {
      userService.getFollowedOrganizers().then(res => {
        setFollowedIds((res.organizers || []).map(o => o._id));
      }).catch(() => {});
    }
  }, []);

  const loadOrganizers = async () => {
    try {
      const res = await userService.getOrganizers({ limit: 200 });
      setOrganizers(res.organizers || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const categories = useMemo(() =>
    [...new Set(organizers.map(o => o.category).filter(Boolean))].sort(),
    [organizers]
  );

  const filtered = useMemo(() => {
    let list = [...organizers];
    if (search.trim()) {
      list = list.filter(o =>
        fuzzy.matchesFuzzy(o.organizerName || '', search) ||
        fuzzy.matchesFuzzy(o.category || '', search) ||
        fuzzy.matchesFuzzy(o.description || '', search)
      );
    }
    if (filterCategory) list = list.filter(o => o.category === filterCategory);
    if (filterFollowed === 'following') list = list.filter(o => followedIds.includes(o._id));
    return list;
  }, [organizers, search, filterCategory, filterFollowed, followedIds]);

  const handleFollow = async (orgId) => {
    if (!isAuthenticated) return toast.error('Please login first');
    try {
      if (followedIds.includes(orgId)) {
        await userService.unfollowOrganizer(orgId);
        setFollowedIds(prev => prev.filter(id => id !== orgId));
        toast.success('Unfollowed');
      } else {
        await userService.followOrganizer(orgId);
        setFollowedIds(prev => [...prev, orgId]);
        toast.success('Following!');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="page-header-row">
        <div>
          <h1>Clubs & Organizers</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>Discover clubs organizing events at Felicity</p>
        </div>
        <span className="text-muted" style={{ fontSize: 13 }}>{filtered.length} club{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="filter-bar">
        <div className="dashboard-search" style={{ flex: 1 }}>
          <span className="search-icon-inner">{'\u{1F50D}'}</span>
          <input type="text" className="form-control search-input" placeholder="Search clubs by name, category..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control filter-select" value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAuthenticated && user?.role === 'participant' && (
          <select className="form-control filter-select" value={filterFollowed}
            onChange={e => setFilterFollowed(e.target.value)}>
            <option value="">All Clubs</option>
            <option value="following">Following Only</option>
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F3E2}'}</div>
          <h3>No clubs found</h3>
          <p className="text-muted">{search || filterCategory ? 'Try different search terms or filters' : 'No clubs available yet'}</p>
        </div>
      ) : (
        <div className="org-grid">
          {filtered.map(org => (
            <div key={org._id} className="org-manage-card">
              <div className="org-manage-header">
                <Link to={`/clubs/${org._id}`} className="org-manage-avatar" style={{ textDecoration: 'none', color: '#fff' }}>
                  {(org.organizerName || '?')[0].toUpperCase()}
                </Link>
                <div className="org-manage-info" style={{ flex: 1 }}>
                  <Link to={`/clubs/${org._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h4>{org.organizerName}</h4>
                  </Link>
                  <span className="badge badge-primary">{org.category}</span>
                </div>
                {isAuthenticated && user?.role === 'participant' && (
                  <button
                    className={`btn btn-sm ${followedIds.includes(org._id) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleFollow(org._id)}
                    aria-label={followedIds.includes(org._id) ? `Unfollow ${org.organizerName}` : `Follow ${org.organizerName}`}
                  >
                    {followedIds.includes(org._id) ? '\u2764\uFE0F Following' : 'Follow'}
                  </button>
                )}
              </div>
              {org.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  {org.description.substring(0, 120)}{org.description.length > 120 ? '...' : ''}
                </p>
              )}
              {org.email ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  {'\u{1F4E7}'} <a href={`mailto:${org.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{org.email}</a>
                </p>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{'\u{1F4E7}'} Not provided</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClubsPage;
