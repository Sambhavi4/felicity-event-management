import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [_step, _setStep] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme: _theme, toggleTheme: _toggleTheme } = useTheme();
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

  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill all fields');
    if (!captchaAnswer) return toast.error('Please enter the CAPTCHA');

    setLoading(true);
    try {
      const res = await login(email, password, captchaId, captchaAnswer);
      toast.success('Welcome back!');
      if (res.user.role === 'participant' && !res.user.onboardingCompleted) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
      loadCaptcha(); // Refresh captcha on failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/felicity-logo.png" alt="Felicity" className="felicity-logo--large" />
          <h1>Login</h1>
          <p className="subtitle">Sign in to your account</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter password" />
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
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <Link to="/register">Create account</Link>
          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
