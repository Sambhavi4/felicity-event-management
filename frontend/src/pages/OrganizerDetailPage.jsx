import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import EventCard from '../components/common/EventCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const OrganizerDetailPage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [organizer, setOrganizer] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    loadOrganizer();
  }, [id]);

  const loadOrganizer = async () => {
    try {
      const res = await userService.getOrganizer(id);
      setOrganizer(res.organizer);
      setUpcomingEvents(res.upcomingEvents || []);
      setPastEvents(res.pastEvents || []);
      // Check if following
      if (isAuthenticated && user?.role === 'participant') {
        try {
          const followRes = await userService.getFollowedOrganizers();
          const ids = (followRes.organizers || []).map(o => o._id);
          setIsFollowing(ids.includes(id));
  } catch { /* ignore follow check errors */ }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) return toast.error('Please login to follow clubs');
    try {
      if (isFollowing) {
        await userService.unfollowOrganizer(id);
        setIsFollowing(false);
        toast.success('Unfollowed');
      } else {
        await userService.followOrganizer(id);
        setIsFollowing(true);
        toast.success('Following!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!organizer) return (
    <div className="container" style={{ textAlign: 'center', padding: 60 }}>
      <h2>Club not found</h2>
      <p className="text-muted" style={{ marginTop: 8 }}>This organizer may not exist or has been removed.</p>
      <a href="/clubs" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Clubs</a>
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>{organizer.organizerName}</h1>
            <span className="badge badge-primary" style={{ marginTop: 6 }}>{organizer.category}</span>
            {organizer.email ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                📧 <a href={`mailto:${organizer.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{organizer.email}</a>
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>📧 Not provided</p>
            )}
          </div>
          {isAuthenticated && user?.role === 'participant' && (
            <button
              className={`btn ${isFollowing ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleFollow}
              aria-label={isFollowing ? 'Unfollow organizer' : 'Follow organizer'}
            >
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
          )}
          {!isAuthenticated && (
            <a href="/login" className="btn btn-secondary">Login to Follow</a>
          )}
        </div>
        {organizer.description && (
          <p style={{ marginTop: 16, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {organizer.description}
          </p>
        )}
      </div>

      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12 }}>🔥 Upcoming Events</h3>
          <div className="grid grid-2">
            {upcomingEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12 }}>📋 Past Events</h3>
          <div className="grid grid-2">
            {pastEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
          </div>
        </div>
      )}

      {upcomingEvents.length === 0 && pastEvents.length === 0 && (
        <div className="card text-center" style={{ padding: 40 }}>
          <p className="text-muted">No events yet from this organizer</p>
        </div>
      )}
    </div>
  );
};

export default OrganizerDetailPage;
