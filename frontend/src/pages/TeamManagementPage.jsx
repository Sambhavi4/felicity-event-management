import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teamService from '../services/teamService';
import registrationService from '../services/registrationService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const TeamManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [myRegistrations, setMyRegistrations] = useState([]);

  useEffect(() => {
    loadTeams();
    loadMyRegistrations();
  }, []);

  const loadMyRegistrations = async () => {
    try {
      const res = await registrationService.getMyRegistrations({});
      setMyRegistrations(res.registrations || []);
  } catch { /* ignore */ }
  };

  const loadTeams = async () => {
    try {
      const res = await teamService.getMyTeams();
      setTeams(res.teams || []);
    } catch {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return toast.error('Please enter invite code');
    setJoining(true);
    try {
      const res = await teamService.joinTeam(joinCode.trim().toUpperCase());
      toast.success(res.message || 'Joined team successfully!');
      setJoinCode('');
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join team');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!confirm('Are you sure you want to leave this team?')) return;
    try {
      await teamService.leaveTeam(teamId);
      toast.success('Left team successfully');
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    try {
      await teamService.deleteTeam(teamId);
      toast.success('Team deleted successfully');
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete team');
    }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container">
      <h1 style={{ marginBottom: 8 }}>My Teams</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>
        Manage your hackathon teams and join new ones
      </p>

      {/* Join Team Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Join a Team</h3>
        <p className="text-muted" style={{ fontSize: 14, marginBottom: 16 }}>
          Have an invite code? Enter it below to join a team.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Enter invite code (e.g., ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinTeam()}
            maxLength={8}
            style={{ textTransform: 'uppercase' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleJoinTeam}
            disabled={joining || !joinCode.trim()}
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
      </div>

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="card">
          <p className="text-muted" style={{ textAlign: 'center' }}>
            You haven't joined any teams yet. Create one on the event details page!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {teams.map((team) => {
            const isLeader = team.teamLeader?._id === user?._id;
            const acceptedMembers = team.members?.filter((m) => m.status === 'accepted') || [];
            const pendingMembers = team.members?.filter((m) => m.status === 'pending') || [];

            return (
              <div key={team._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, marginBottom: 4 }}>{team.teamName}</h3>
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      Event: {team.event?.name || 'Unknown'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {team.isComplete ? (
                      <span className="badge badge-success">Complete</span>
                    ) : (
                      <span className="badge badge-warning">Incomplete</span>
                    )}
                    {isLeader && <span className="badge badge-primary">Leader</span>}
                  </div>
                </div>

                {/* Team Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Team Leader</span>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>
                      {team.teamLeader?.firstName} {team.teamLeader?.lastName}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Team Size</span>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>
                      {acceptedMembers.length + 1} / {team.teamSize}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Event Date</span>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>
                      {formatDate(team.event?.eventStartDate)}
                    </p>
                  </div>
                </div>

                {/* Invite Code */}
                {!team.isComplete && isLeader && (
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invite Code</span>
                        <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>
                          {team.inviteCode}
                        </p>
                      </div>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => copyInviteCode(team.inviteCode)}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* Members */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Team Members</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {acceptedMembers.map((member) => (
                      <div
                        key={member._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>
                          {member.user?.firstName} {member.user?.lastName}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: 11 }}>
                          Accepted
                        </span>
                      </div>
                    ))}
                    {pendingMembers.map((member) => (
                      <div
                        key={member._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                          {member.user?.firstName} {member.user?.lastName}
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: 11 }}>
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {team.isComplete && (() => {
                    // Find this user's own registration for this team's event
                    const eventId = team.event?._id || team.event;
                    const myReg = myRegistrations.find(r => {
                      const regEventId = r.event?._id || r.event;
                      const regTeamId = r.team || r.teamId;
                      return regEventId?.toString() === eventId?.toString() && regTeamId?.toString() === team._id?.toString();
                    }) || myRegistrations.find(r => {
                      const regEventId = r.event?._id || r.event;
                      return regEventId?.toString() === eventId?.toString();
                    });
                    return myReg ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/ticket/${myReg._id}`)}
                      >
                        View My Ticket
                      </button>
                    ) : team.registrationId ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/ticket/${typeof team.registrationId === 'object' ? team.registrationId._id : team.registrationId}`)}
                      >
                        View Team Ticket
                      </button>
                    ) : null;
                  })()}
                  {isLeader && !team.isComplete && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteTeam(team._id)}
                    >
                      Delete Team
                    </button>
                  )}
                  {!isLeader && !team.isComplete && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLeaveTeam(team._id)}
                    >
                      Leave Team
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamManagementPage;
