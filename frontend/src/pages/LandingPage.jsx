import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Countdown to Felicity: 13 Feb 2026
  const targetDate = new Date('2026-02-13T00:00:00+05:30');
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  function getTimeLeft() {
    const diff = Math.max(0, targetDate - new Date());
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-page">
      {/* Floating theme toggle */}
      <button className="landing-theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Animated background */}
      <div className="landing-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Hero Section */}
      <div className="landing-hero">
        {/* Date badge */}
        <div className="landing-date-badge">
          <span>13 — 15 FEB 2026</span>
        </div>

        <div className="landing-logo-wrapper">
          <div className="landing-logo-glow"></div>
          <img src="/felicity-logo.png" alt="Felicity 2026" className="landing-logo landing-logo--xlarge" />
        </div>

        <p className="landing-subtitle">The Disco Edition</p>
        <p className="landing-desc">
          IIIT Hyderabad's Annual Techno-Cultural Fest
        </p>

        {/* Countdown Timer */}
        <div className="landing-countdown">
          <div className="countdown-unit">
            <span className="countdown-value">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="countdown-label">DAYS</span>
          </div>
          <span className="countdown-sep">:</span>
          <div className="countdown-unit">
            <span className="countdown-value">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="countdown-label">HOURS</span>
          </div>
          <span className="countdown-sep">:</span>
          <div className="countdown-unit">
            <span className="countdown-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="countdown-label">MINUTES</span>
          </div>
          <span className="countdown-sep">:</span>
          <div className="countdown-unit">
            <span className="countdown-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="countdown-label">SECONDS</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="landing-cta">
          <Link to="/register" className="landing-btn landing-btn-register">
            REGISTER NOW
          </Link>
        </div>
        <div className="landing-cta" style={{ marginTop: 12 }}>
          <Link to="/login" className="landing-btn landing-btn-primary">
            <span>Login</span>
            <span>→</span>
          </Link>
          <Link to="/events" className="landing-btn landing-btn-secondary">
            <span>Browse Events</span>
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="landing-features">
        <div className="feature-card fade-up">
          <div className="feature-icon">📅</div>
          <h3>Events & Workshops</h3>
          <p>Register for hackathons, workshops, talks and competitions with a single click</p>
        </div>
        <div className="feature-card fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="feature-icon">🛍️</div>
          <h3>Merchandise Store</h3>
          <p>Browse and purchase official fest merchandise with variant selection and stock tracking</p>
        </div>
        <div className="feature-card fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="feature-icon">🏢</div>
          <h3>Clubs & Organizers</h3>
          <p>Follow your favorite clubs and stay updated on upcoming events and announcements</p>
        </div>
        <div className="feature-card fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="feature-icon">🎫</div>
          <h3>Digital Tickets & QR</h3>
          <p>Get instant digital tickets with QR codes for seamless event check-in</p>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5, fontSize: 13 }}>
        Built for IIIT Hyderabad • Felicity Event Management System
      </div>
    </div>
  );
};

export default LandingPage;
