import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import toast from 'react-hot-toast';

const INTERESTS = ['Technical', 'Cultural', 'Sports', 'Literary', 'Gaming', 'Music', 'Art', 'Dance', 'Drama', 'Photography', 'Robotics', 'AI/ML', 'Coding', 'Quiz', 'Debate', 'Entrepreneurship', 'Design', 'Film'];

const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loading, setLoading] = useState(false);
  const { completeOnboarding } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    userService.getOrganizers({ limit: 100 }).then(res => {
      setOrganizers(res.organizers || []);
    }).catch(() => {});
  }, []);

  const toggleInterest = (i) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const toggleFollow = (id) => {
    setFollowed(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await completeOnboarding({ skip: true });
      toast.success('Welcome to Felicity!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeOnboarding({ interests, followedOrganizers: followed });
      toast.success('Welcome to Felicity!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 600 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/felicity-logo.png" alt="Felicity" className="felicity-logo--large" />
          <h1 style={{ fontSize: 24 }}>Setup Your Profile</h1>
          <p className="subtitle">Step {step} of 2</p>
        </div>

        {step === 1 && (
          <>
            <h3 style={{ marginBottom: 16 }}>What are you interested in?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Select your areas of interest to get personalized event recommendations.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INTERESTS.map(i => (
                <button key={i} className={`interest-chip ${interests.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(i)}>
                  {i}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleSkip} disabled={loading}>
                Skip for now
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => setStep(2)}>
                Next →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ marginBottom: 16 }}>Follow Clubs</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Follow clubs to get updates about their events. You can change this later from your Profile.
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {organizers.map(org => (
                <div key={org._id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderBottom: '1px solid var(--border-color)'
                }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{org.organizerName}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{org.category}</p>
                  </div>
                  <button className={`btn btn-sm ${followed.includes(org._id) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleFollow(org._id)}>
                    {followed.includes(org._id) ? '✓ Following' : 'Follow'}
                  </button>
                </div>
              ))}
              {organizers.length === 0 && <p className="text-muted">No clubs available yet</p>}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleComplete} disabled={loading}>
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
