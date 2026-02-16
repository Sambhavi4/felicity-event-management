import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import eventService from '../services/eventService';
import registrationService from '../services/registrationService';
import teamService from '../services/teamService';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD';

const EventDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [formResponses, setFormResponses] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('details');
  // Discussion
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);      // { _id, author, content }
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const chatEndRef = useRef(null);
  // Feedback
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [filterRating, setFilterRating] = useState('');
  const [myRegistration, setMyRegistration] = useState(null);
  // Team
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [myTeam, setMyTeam] = useState(null);
  // Participants (organizer view)
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [id]);

  useEffect(() => {
    if (tab === 'discussion') loadMessages();
    if (tab === 'feedback') loadFeedback();
    if (tab === 'participants') loadParticipants();
  }, [tab, filterRating]);

  // Auto-poll discussion messages every 5 seconds for real-time feel
  useEffect(() => {
    if (tab !== 'discussion') return;
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, id]);

  const loadEvent = async () => {
    try {
      const res = await eventService.getEvent(id);
      setEvent(res.event);
      if (res.event.customFields?.length) {
        setFormResponses(res.event.customFields.map(f => ({ fieldId: f.fieldId, value: '' })));
      }
      // Check registration
      if (isAuthenticated && user?.role === 'participant') {
        try {
          const regRes = await registrationService.getMyRegistrations({ type: res.event.eventType === 'merchandise' ? 'merchandise' : 'normal' });
          const registrations = regRes.registrations || [];
          const found = registrations.find(r => {
            const ev = r.event;
            if (!ev) return false;
            // ev may be an id string or a populated object with _id
            if (typeof ev === 'string' || ev instanceof String) return ev.toString() === id;
            if (ev._id) return ev._id.toString() === id;
            return false;
          });
          if (found) setMyRegistration(found);
  } catch { /* ignore */ }

        // Check if user has a team for this event
        if (res.event.isTeamEvent) {
          try {
            const teamRes = await teamService.getMyTeams();
            const teams = teamRes.teams || [];
            const myTeamForEvent = teams.find(t => {
              const evId = t.event?._id || t.event;
              return evId?.toString() === id;
            });
            if (myTeamForEvent) setMyTeam(myTeamForEvent);
          } catch { /* ignore */ }
        }
      }
    } catch {
      toast.error('Event not found');
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await api.get(`/discussions/${id}`);
      setMessages(res.data.messages || []);
  } catch { /* ignore */ }
  };

  const loadFeedback = async () => {
    try {
      const params = filterRating ? `?rating=${filterRating}` : '';
      const res = await api.get(`/feedback/${id}${params}`);
      setFeedback(res.data.feedback || res.data.feedbacks || []);
      setAvgRating(res.data.averageRating || parseFloat(res.data.stats?.averageRating) || 0);
      setFeedbackStats(res.data.stats || null);
  } catch { /* ignore */ }
  };

  const loadParticipants = async () => {
    setParticipantsLoading(true);
    try {
      const res = await registrationService.getEventRegistrations(id, { limit: 200 });
      setParticipants(res.registrations || []);
    } catch { /* ignore */ } finally { setParticipantsLoading(false); }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) return navigate('/login');
    setRegistering(true);
    try {
      if (event.eventType === 'merchandise') {
        if (!selectedVariant) return toast.error('Please select a variant');
        const res = await registrationService.purchaseMerchandise(id, selectedVariant, quantity);
        setMyRegistration(res.registration);
        toast.success('Purchase successful!');
        // If payment is pending, take user straight to the ticket page to upload proof
        if (res.registration && res.registration.paymentStatus === 'pending') {
          navigate(`/ticket/${res.registration._id}`);
        } else {
          // Redirect user to dashboard and open Merchandise tab so the new purchase is visible
          navigate('/dashboard#merchandise');
        }
      } else {
        // validate required custom fields
        if (event.customFields?.length) {
          for (const field of event.customFields) {
            if (field.required) {
              const resp = formResponses.find(r => r.fieldId === field.fieldId);
              if (!resp?.value) return toast.error(`Please fill: ${field.label}`);
            }
          }
        }
        const res = await registrationService.registerForEvent(id, formResponses);
        setMyRegistration(res.registration);
        toast.success('Registered successfully!');
        // If registration is pending payment, navigate to ticket page so user can upload proof
        if (res.registration && res.registration.paymentStatus === 'pending') {
          navigate(`/ticket/${res.registration._id}`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/discussions/${id}`, {
        content: newMessage,
        parentMessage: replyTo?._id || null,
        isAnnouncement
      });
      setNewMessage('');
      setReplyTo(null);
      setIsAnnouncement(false);
      loadMessages();
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch {
      toast.error('Failed to send');
    }
  };

  const submitFeedback = async () => {
    if (rating === 0) return toast.error('Please select a rating');
    try {
      await api.post(`/feedback/${id}`, { rating, comment });
      toast.success('Feedback submitted!');
      setRating(0);
      setComment('');
      loadFeedback();
    } catch {
      toast.error('Failed');
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return toast.error('Please enter a team name');
    if (!teamSize) return toast.error('Please select team size');
    setCreatingTeam(true);
    try {
      const res = await teamService.createTeam(id, teamName, teamSize);
      toast.success('Team created! Share the invite code with your teammates.');
      setMyTeam(res.team);
      setTeamName('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleJoinTeamFromEvent = async () => {
    if (!joinCode.trim()) return toast.error('Enter an invite code');
    setJoiningTeam(true);
    try {
      const res = await teamService.joinTeam(joinCode.trim().toUpperCase());
      toast.success(res.message || 'Joined team!');
      setMyTeam(res.team);
      setJoinCode('');
      // Reload to check if registration was created
      loadEvent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join team');
    } finally {
      setJoiningTeam(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return null;

  const isOpen = event.status === 'published' && 
    event.registrationDeadline && new Date() < new Date(event.registrationDeadline) && 
    (!event.registrationLimit || event.registrationCount < event.registrationLimit);
  const isOrganizer = user?._id === event.organizer?._id;
  // Show feedback tab when event has been marked completed/closed or when the event end time has passed
  const eventEnded = event.eventEndDate && new Date() > new Date(event.eventEndDate);
  const showFeedbackTab = ['completed', 'closed'].includes(event.status) || eventEnded;

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24 }}>{event.name}</h1>
            <p className="text-muted" style={{ marginTop: 4 }}>
              by {event.organizer?.organizerName || 'Unknown'}
              {event.organizer?.category && <span> &middot; {event.organizer.category}</span>}
            </p>
          </div>
          {/* Compact callout for manual payment required with quick action.
              Show for any paid event so users can upload proof even if the event flag wasn't set. */}
          {event.registrationFee > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: 'var(--warning)', marginRight: 6 }}>Manual Payment Required</strong>
                <span className="text-muted" style={{ fontSize: 13 }}>This event requires manual payment verification.</span>
              </span>
              {/* Treat a cancelled registration as not-registered so user can re-register */}
              {myRegistration && myRegistration.status !== 'cancelled' ? (
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/ticket/${myRegistration._id}`)}>Upload payment proof</button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={handleRegister}>Register & Upload Proof</button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${event.eventType === 'merchandise' ? 'badge-success' : 'badge-primary'}`}>
              {event.eventType === 'merchandise' ? 'Merchandise' : 'Event'}
            </span>
            <span className={`badge ${event.status === 'published' ? 'badge-info' : event.status === 'completed' ? 'badge-warning' : 'badge-primary'}`}>
              {event.status}
            </span>
            {event.eligibility !== 'all' && (
              <span className="badge badge-warning">{event.eligibility === 'iiit-only' ? 'IIIT Only' : 'Non-IIIT Only'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>Details</button>
        {isAuthenticated && <button className={`tab ${tab === 'discussion' ? 'active' : ''}`} onClick={() => setTab('discussion')}>Discussion</button>}
        {showFeedbackTab && <button className={`tab ${tab === 'feedback' ? 'active' : ''}`} onClick={() => setTab('feedback')}>Feedback</button>}
        {isOrganizer && <button className={`tab ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>Participants</button>}
      </div>

      {tab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <div>
            {/* Description removed per request (keep page concise) */}

            {event.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {event.tags.map(t => <span key={t} className="badge badge-info">{t}</span>)}
              </div>
            )}

            {/* Custom Registration Form */}
            {event.customFields?.length > 0 && !myRegistration && event.eventType !== 'merchandise' && isOpen && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16 }}>Registration Form</h3>
                {event.customFields.sort((a, b) => a.order - b.order).map(field => (
                  <div className="form-group" key={field.fieldId}>
                    <label>{field.label} {field.required && '*'}</label>
                    {field.type === 'textarea' ? (
                      <textarea className="form-control" placeholder={field.placeholder || ''}
                        value={formResponses.find(r => r.fieldId === field.fieldId)?.value || ''}
                        onChange={e => setFormResponses(prev => prev.map(r => r.fieldId === field.fieldId ? { ...r, value: e.target.value } : r))} />
                    ) : field.type === 'select' || field.type === 'dropdown' ? (
                      <select className="form-control"
                        value={formResponses.find(r => r.fieldId === field.fieldId)?.value || ''}
                        onChange={e => setFormResponses(prev => prev.map(r => r.fieldId === field.fieldId ? { ...r, value: e.target.value } : r))}>
                        <option value="">Select...</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <input type="checkbox"
                        checked={formResponses.find(r => r.fieldId === field.fieldId)?.value === 'true'}
                        onChange={e => setFormResponses(prev => prev.map(r => r.fieldId === field.fieldId ? { ...r, value: String(e.target.checked) } : r))} />
                    ) : (
                      <input type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                        className="form-control" placeholder={field.placeholder || ''}
                        value={formResponses.find(r => r.fieldId === field.fieldId)?.value || ''}
                        onChange={e => setFormResponses(prev => prev.map(r => r.fieldId === field.fieldId ? { ...r, value: e.target.value } : r))} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><strong>Date:</strong> {formatDate(event.eventStartDate)}</div>
                {event.eventEndDate && <div><strong>Ends:</strong> {formatDate(event.eventEndDate)}</div>}
                <div><strong>Deadline:</strong> {formatDate(event.registrationDeadline)}</div>
                {event.venue && <div><strong>Venue:</strong> {event.venue}</div>}
                <div><strong>Registered:</strong> {event.registrationCount || 0}{event.registrationLimit ? ` / ${event.registrationLimit}` : ''}</div>
                {event.registrationFee > 0 && <div><strong>Fee:</strong> Rs.{event.registrationFee}</div>}
                {event.isTeamEvent && <div><strong>Team Size:</strong> {event.minTeamSize}-{event.maxTeamSize}</div>}
              </div>
            </div>

            {/* Merchandise Variants */}
            {event.eventType === 'merchandise' && event.variants?.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>Variants</h3>
                {event.variants.map(v => (
                  <label key={v._id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="radio" name="variant" value={v._id}
                        checked={selectedVariant === v._id} onChange={() => setSelectedVariant(v._id)} />
                      <span>{v.name} {v.size && `(${v.size})`} {v.color && `- ${v.color}`}</span>
                    </div>
                    <span>Rs.{v.price} ({v.stock - v.sold} left)</span>
                  </label>
                ))}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Quantity</label>
                  <input type="number" className="form-control" min="1" max={event.purchaseLimit || 10}
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </div>
              </div>
            )}

            {/* Action Button */}
            {/* Team Event UI */}
            {event.isTeamEvent && isAuthenticated && user?.role === 'participant' && !myRegistration && (
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>Team Registration</h3>
                {myTeam ? (
                  <div>
                    <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{myTeam.teamName}</p>
                      <p className="text-muted" style={{ fontSize: 12 }}>
                        {(myTeam.members?.filter(m => m.status === 'accepted').length || 0) + 1} / {myTeam.teamSize} members
                      </p>
                      {myTeam.isComplete ? (
                        <span className="badge badge-success" style={{ marginTop: 4 }}>Team Complete!</span>
                      ) : (
                        <>
                          <span className="badge badge-warning" style={{ marginTop: 4 }}>Waiting for members</span>
                          {myTeam.inviteCode && myTeam.teamLeader?._id === user?._id && (
                            <div style={{ marginTop: 8 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invite Code:</span>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                                <code style={{ fontSize: 18, fontWeight: 700 }}>{myTeam.inviteCode}</code>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                  navigator.clipboard.writeText(myTeam.inviteCode);
                                  toast.success('Invite code copied!');
                                }}>📋 Copy</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}
                      onClick={() => navigate('/teams')}>Manage Team</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                      This is a team event. Create a team or join one with an invite code.
                    </p>
                    {/* Create Team */}
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Create a Team</h4>
                      <div className="form-group">
                        <input type="text" className="form-control" placeholder="Team Name"
                          value={teamName} onChange={e => setTeamName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <select className="form-control" value={teamSize}
                          onChange={e => setTeamSize(Number(e.target.value))}>
                          <option value={0}>Select Team Size</option>
                          {Array.from({ length: (event.maxTeamSize || 5) - (event.minTeamSize || 2) + 1 }, (_, i) => i + (event.minTeamSize || 2)).map(n => (
                            <option key={n} value={n}>{n} members</option>
                          ))}
                        </select>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
                        onClick={handleCreateTeam} disabled={creatingTeam}>
                        {creatingTeam ? 'Creating...' : 'Create Team'}
                      </button>
                    </div>
                    {/* Join Team */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Or Join a Team</h4>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" className="form-control" placeholder="Invite Code"
                          value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && handleJoinTeamFromEvent()}
                          maxLength={8} style={{ textTransform: 'uppercase' }} />
                        <button className="btn btn-primary btn-sm" onClick={handleJoinTeamFromEvent}
                          disabled={joiningTeam}>
                          {joiningTeam ? '...' : 'Join'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {myRegistration ? (
              <div>
                {myRegistration.status === 'cancelled' ? (
                  <>
                    <div className="alert alert-danger">Registration cancelled</div>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleRegister}>Register again</button>
                  </>
                ) : myRegistration.status === 'pending' ? (
                  <>
                    <div className="alert alert-warning">Registration pending payment verification</div>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate(`/ticket/${myRegistration._id}`)}>View Ticket</button>
                  </>
                ) : (
                  <>
                    <div className="alert alert-success">You are registered!</div>
                    <button className="btn btn-primary" style={{ width: '100%' }}
                      onClick={() => navigate(`/ticket/${myRegistration._id}`)}>
                      View Ticket
                    </button>
                  </>
                )}
              </div>
            ) : isOrganizer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-secondary" style={{ width: '100%' }}
                  onClick={() => navigate(`/edit-event/${event._id}`)}>Edit Event</button>
                <button className="btn btn-primary" style={{ width: '100%' }}
                  onClick={() => navigate(`/event-registrations/${event._id}`)}>View Registrations</button>
              </div>
            ) : isOpen ? (
              <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleRegister} disabled={registering}>
                {registering ? 'Processing...' : event.eventType === 'merchandise' ? 'Purchase' : 'Register'}
              </button>
            ) : (
              <div className="alert alert-danger">Registration is closed</div>
            )}
          </div>
        </div>
      )}

      {/* Discussion Tab */}
      {tab === 'discussion' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Discussion Forum</h3>
            <span className="badge badge-info" style={{ fontSize: 11 }}>🔴 Live — auto-refreshes every 5s</span>
          </div>

          {/* Pinned messages first */}
          {messages.filter(m => m.isPinned).length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,193,7,0.08)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,193,7,0.3)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>📌 Pinned Messages</p>
              {messages.filter(m => m.isPinned).map(msg => (
                <div key={msg._id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}>
                    {msg.author?.firstName || msg.author?.organizerName || 'User'}
                  </span>
                  {msg.isAnnouncement && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>📢 Announcement</span>}
                  <div style={{ fontSize: 13, marginTop: 4 }}>{msg.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* All messages — threaded */}
          <div style={{ marginBottom: 16, maxHeight: 500, overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <p className="text-muted">No messages yet. Start the conversation!</p>
            ) : (
              (() => {
                // Group into threads: top-level messages + their replies
                const topLevel = messages.filter(m => !m.parentMessage);
                const replies = messages.filter(m => m.parentMessage);
                const replyMap = {};
                replies.forEach(r => {
                  const parentId = typeof r.parentMessage === 'object' ? r.parentMessage._id : r.parentMessage;
                  if (!replyMap[parentId]) replyMap[parentId] = [];
                  replyMap[parentId].push(r);
                });

                const renderMsg = (msg, isReply = false) => (
                  <div key={msg._id} style={{
                    padding: '10px 14px', marginBottom: isReply ? 4 : 8,
                    marginLeft: isReply ? 28 : 0,
                    background: msg.isAnnouncement ? 'rgba(239,68,68,0.06)' : isReply ? 'var(--bg-tertiary, var(--bg-secondary))' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    border: msg.isPinned ? '1px solid rgba(255,193,7,0.4)' : msg.isAnnouncement ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-color)',
                    fontSize: isReply ? 13 : 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {isReply && msg.parentMessage?.author && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                            ↳ replying to {msg.parentMessage.author.firstName || msg.parentMessage.author.organizerName || 'User'}
                          </span>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}>
                          {msg.author?.firstName || msg.author?.organizerName || 'User'}
                        </span>
                        {msg.author?.role === 'organizer' && <span className="badge badge-success" style={{ marginLeft: 6, fontSize: 10 }}>Organizer</span>}
                        {msg.isAnnouncement && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>📢 Announcement</span>}
                        {msg.isPinned && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>📌</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {/* Moderation + Reply */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {/* Reply button for everyone */}
                        {isAuthenticated && (
                          <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => setReplyTo({ _id: msg._id, author: msg.author, content: msg.content })}>
                            ↩ Reply
                          </button>
                        )}
                        {/* Organizer moderation controls */}
                        {isOrganizer && (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={async () => {
                                try { await api.put(`/discussions/${id}/${msg._id}/pin`); loadMessages(); } catch { toast.error('Failed'); }
                              }}>
                              {msg.isPinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--danger)' }}
                              onClick={async () => {
                                try { await api.delete(`/discussions/${id}/${msg._id}`); loadMessages(); } catch { toast.error('Failed'); }
                              }}>
                              Delete
                            </button>
                          </>
                        )}
                        {/* Author can delete their own */}
                        {!isOrganizer && msg.author?._id === user?._id && (
                          <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--danger)' }}
                            onClick={async () => {
                              try { await api.delete(`/discussions/${id}/${msg._id}`); loadMessages(); } catch { toast.error('Failed'); }
                            }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: isReply ? 13 : 14, marginTop: 6, lineHeight: 1.5 }}>{msg.content}</div>
                    {/* Reactions */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {['👍', '❤️', '😂', '🎉', '👏', '🔥'].map(emoji => {
                        const count = (msg.reactions || []).filter(r => r.emoji === emoji).length;
                        const myReaction = (msg.reactions || []).some(r => r.emoji === emoji && (r.user === user?._id || r.user?._id === user?._id));
                        return (
                          <button key={emoji} onClick={async () => {
                            try { await api.post(`/discussions/${id}/${msg._id}/react`, { emoji }); loadMessages(); } catch { /* ignore */ }
                          }} style={{
                            background: myReaction ? 'var(--primary-alpha, rgba(99,102,241,0.15))' : 'transparent',
                            border: `1px solid ${myReaction ? 'var(--primary)' : 'var(--border-color)'}`,
                            borderRadius: 12, padding: '2px 8px', fontSize: 13,
                            cursor: 'pointer', opacity: count > 0 ? 1 : 0.4, transition: 'all .2s'
                          }}>
                            {emoji} {count > 0 && <span style={{ fontSize: 11 }}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );

                return topLevel.map(msg => (
                  <div key={msg._id}>
                    {renderMsg(msg)}
                    {replyMap[msg._id]?.map(r => renderMsg(r, true))}
                  </div>
                ));
              })()
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Reply indicator */}
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 8, fontSize: 13 }}>
              <span>↩ Replying to <strong>{replyTo.author?.firstName || replyTo.author?.organizerName || 'User'}</strong>: "{replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '...' : ''}"</span>
              <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}>✕</button>
            </div>
          )}

          {/* Message input */}
          {isAuthenticated && (
            <div>
              {/* Organizer: announcement toggle */}
              {isOrganizer && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isAnnouncement} onChange={e => setIsAnnouncement(e.target.checked)} />
                  📢 Post as Announcement
                </label>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" placeholder={replyTo ? 'Type your reply...' : 'Type a message...'} value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <button className="btn btn-primary" onClick={sendMessage}>Send</button>
              </div>
            </div>
          )}
          {!isAuthenticated && (
            <p className="text-muted" style={{ fontSize: 13 }}>Log in and register for this event to join the discussion.</p>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {tab === 'feedback' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>Event Feedback</h3>
              <p className="text-muted" style={{ fontSize: 14 }}>
                Average: <strong>{typeof avgRating === 'number' ? avgRating.toFixed(1) : '0.0'}</strong> / 5
                {feedbackStats && <span> &middot; {feedbackStats.totalFeedbacks} response{feedbackStats.totalFeedbacks !== 1 ? 's' : ''}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="form-control" style={{ width: 140, fontSize: 13 }}
                value={filterRating} onChange={e => setFilterRating(e.target.value)}>
                <option value="">All Ratings</option>
                {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
              </select>
              {(isOrganizer || user?.role === 'admin') && (
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const url = `/api/feedback/${id}/export${filterRating ? `?rating=${filterRating}` : ''}`;
                  // Use auth token to fetch and download
                  api.get(url, { responseType: 'blob' }).then(res => {
                    const blob = new Blob([res.data], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `feedback_${id}.csv`;
                    a.click();
                  }).catch(() => toast.error('Export failed'));
                }}>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Participants Tab (organizer only) */}
          {tab === 'participants' && isOrganizer && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>Participants</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => loadParticipants()}>Refresh</button>
                  <button className="btn btn-secondary btn-sm" onClick={async () => {
                    try {
                      const blob = await registrationService.exportRegistrations(id);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `registrations_${id}.csv`;
                      a.click();
                    } catch { toast.error('Export failed'); }
                  }}>Export CSV</button>
                </div>
              </div>
              {participantsLoading ? (
                <LoadingSpinner />
              ) : participants.length === 0 ? (
                <p className="text-muted">No registrations yet.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {participants.map(r => (
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

          {/* Rating Distribution */}
          {feedbackStats?.ratingDistribution && (
            <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              {[5,4,3,2,1].map(star => {
                const count = feedbackStats.ratingDistribution[star] || 0;
                const pct = feedbackStats.totalFeedbacks > 0 ? (count / feedbackStats.totalFeedbacks * 100) : 0;
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                    <span style={{ width: 50 }}>{star} ★</span>
                    <div style={{ flex: 1, height: 10, background: 'var(--border-color)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 5, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 30, textAlign: 'right', color: 'var(--text-muted)' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit feedback form — only for participants */}
          {isAuthenticated && user?.role === 'participant' && (
            <div style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>Rate this event:</p>
              <div className="stars" style={{ marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className={`star ${s <= rating ? 'filled' : ''}`} onClick={() => setRating(s)}
                    style={{ cursor: 'pointer', fontSize: 24, marginRight: 4 }}>
                    {s <= rating ? '\u2605' : '\u2606'}
                  </span>
                ))}
              </div>
              <textarea className="form-control" placeholder="Leave a comment (optional, anonymous)..."
                value={comment} onChange={e => setComment(e.target.value)} rows={2} />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={submitFeedback}>Submit</button>
            </div>
          )}

          {feedback.length === 0 ? (
            <p className="text-muted">No feedback yet{filterRating ? ` with ${filterRating}-star rating` : ''}</p>
          ) : (
            feedback.map((fb, i) => (
              <div key={fb._id || i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div className="stars" style={{ marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} style={{ fontSize: 14, cursor: 'default', color: s <= fb.rating ? '#f59e0b' : '#555' }}>
                      {s <= fb.rating ? '\u2605' : '\u2606'}
                    </span>
                  ))}
                </div>
                {fb.comment && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{fb.comment}</p>}
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(fb.createdAt).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default EventDetailsPage;
