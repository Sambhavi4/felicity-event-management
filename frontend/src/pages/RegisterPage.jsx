import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const RegisterPage = () => {
  const [step, setStep] = useState('choice');
  const [participantType, setParticipantType] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', contactNumber: '', collegeName: '' });
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const loadCaptcha = useCallback(async () => {
    try {
      const data = await authService.getCaptcha();
      setCaptchaId(data.captchaId);
      setCaptchaSvg(data.captchaSvg);
      setCaptchaAnswer('');
    } catch {
      console.error('Failed to load CAPTCHA');
    }
  }, []);

  // Load CAPTCHA when user moves to the form step
  useEffect(() => {
    if (step === 'form') loadCaptcha();
  }, [step, loadCaptcha]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      return toast.error('Please fill all required fields');
    }
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (!captchaAnswer) return toast.error('Please enter the CAPTCHA');

    // If user selected IIIT, enforce IIIT email domain
    if (participantType === 'iiit') {
      const validDomains = ['iiit.ac.in', 'students.iiit.ac.in', 'research.iiit.ac.in'];
      const domain = form.email.split('@')[1];
      if (!validDomains.includes(domain)) return toast.error('Please use your IIIT email');
    }

    // If user selected External, disallow IIIT email domains
    if (participantType === 'non-iiit') {
      const iiitDomains = ['iiit.ac.in', 'students.iiit.ac.in', 'research.iiit.ac.in'];
      const domain = form.email.split('@')[1];
      if (iiitDomains.includes(domain)) return toast.error('External participants must not use an IIIT email address');
    }

    setLoading(true);
    try {
      // Send selected participantType to backend
      await register({ ...form, participantType, captchaId, captchaAnswer });
      toast.success('Registration successful!');
      navigate('/onboarding');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
      loadCaptcha(); // Refresh captcha on failure
    } finally {
      setLoading(false);
    }
  };

  if (step === 'choice') {
    return (
      <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div className="auth-card" style={{ padding: 14, maxWidth: 480, width: '96%', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <img src="/felicity-logo.png" alt="Felicity" className="felicity-logo--large" />
            <h1 style={{ marginTop: 6, fontSize: 22 }}>Join Felicity</h1>
            <p className="subtitle" style={{ marginTop: 6 }}>Choose your registration type</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
              onClick={() => { setParticipantType('iiit'); setStep('form'); }}>
              IIIT Hyderabad Student
            </button>
            <button className="btn btn-secondary btn-lg" style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
              onClick={() => { setParticipantType('non-iiit'); setStep('form'); }}>
              External Participant
            </button>
          </div>
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            Already have an account? <Link to="/login">Login here</Link>
          </p>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div className="auth-card" style={{ maxWidth: 640, width: '96%', padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img src="/felicity-logo.png" alt="Felicity" className="felicity-logo--large" style={{ width: 'auto', height: 'auto' }} />
          <h1 style={{ marginTop: 6, fontSize: 20 }}>Register</h1>
          <p className="subtitle">Participant Registration</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>First Name *</label>
              <input name="firstName" className="form-control" value={form.firstName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input name="lastName" className="form-control" value={form.lastName} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange}
              placeholder={participantType === 'iiit' ? 'yourname@students.iiit.ac.in' : 'you@example.com'} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input name="contactNumber" className="form-control" value={form.contactNumber} onChange={handleChange} />
          </div>
          {participantType === 'non-iiit' && (
            <div className="form-group">
              <label>College / Organization</label>
              <input name="collegeName" className="form-control" value={form.collegeName} onChange={handleChange} />
            </div>
          )}
          <div className="form-group">
            <label>Password *</label>
            <input name="password" type="password" className="form-control" value={form.password} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Confirm Password *</label>
            <input name="confirmPassword" type="password" className="form-control" value={form.confirmPassword} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>CAPTCHA</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div dangerouslySetInnerHTML={{ __html: captchaSvg }}
                style={{ border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }} />
              <button type="button" onClick={loadCaptcha}
                style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}
                title="Refresh CAPTCHA">&#x21bb;</button>
            </div>
            <input type="text" className="form-control" value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)}
              placeholder="Enter the text shown above" autoComplete="off" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
            disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <button className="btn-link" onClick={() => navigate('/login')}>Back</button>
          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
          <Link to="/login">Already have an account?</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
