import { Link } from 'react-router-dom';

const formatDate = (d) => {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const EventCard = ({ event }) => {
  const {
    _id, name, description, eventType, eventStartDate, registrationDeadline,
    registrationCount, registrationLimit, organizer, venue, tags, registrationFee, eligibility
  } = event;

  const deadlinePassed = registrationDeadline && new Date() > new Date(registrationDeadline);
  const isFull = registrationLimit && registrationCount >= registrationLimit;
  const progress = registrationLimit ? Math.min((registrationCount || 0) / registrationLimit * 100, 100) : 0;

  return (
    <Link to={`/events/${_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="event-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</h3>
            {organizer && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                by {organizer.organizerName || 'Unknown'}
              </p>
            )}
          </div>
          <span className={`badge ${eventType === 'merchandise' ? 'badge-success' : 'badge-primary'}`}>
            {eventType === 'merchandise' ? 'Merch' : 'Event'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description?.substring(0, 100)}{description?.length > 100 ? '...' : ''}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{'\u{1F4C5}'} {formatDate(eventStartDate)}</span>
          {venue && <span>{'\u{1F4CD}'} {venue}</span>}
          {registrationFee > 0 && <span>{'\u{20B9}'}{registrationFee}</span>}
        </div>

        {registrationLimit > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>{registrationCount || 0}/{registrationLimit} registered</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: progress >= 90 ? 'var(--danger)' : progress >= 60 ? 'var(--warning)' : 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        )}

        {tags && tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="badge badge-info">{tag}</span>
            ))}
            {tags.length > 3 && <span className="badge badge-info">+{tags.length - 3}</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {eligibility && eligibility !== 'all' && (
            <span className="badge badge-warning">
              {eligibility === 'iiit-only' ? 'IIIT Only' : 'Non-IIIT Only'}
            </span>
          )}
          {deadlinePassed && <span className="badge badge-danger">Closed</span>}
          {isFull && !deadlinePassed && <span className="badge badge-warning">Full</span>}
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
