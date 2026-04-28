import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstallPrompt from '../components/InstallPrompt';

export default function WelcomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-container">
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/dashboard'} replace />;
  }

  return (
    <div className="hero-section">
      <div className="hero-badge">
        <span>⚓</span> Marine Spare Parts Marketplace
      </div>

      <h1 className="hero-title">
        Welcome To <span className="hero-title-gradient">Vortex</span>
      </h1>

      <p className="hero-subtitle">
        Your trusted marketplace for premium marine spare parts and equipment. Connect with verified global vendors instantly.
      </p>

      <div className="hero-cta">
        <Link to="/login" className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-xl)' }}>
          Enter Vortex →
        </Link>
      </div>

      <div className="hero-features">
        <div className="hero-feature-card">
          <div className="hero-feature-icon">🔍</div>
          <h3 className="hero-feature-title">Smart Search</h3>
          <p className="hero-feature-desc">
            Fuzzy search with typo tolerance finds exactly what you need, even with misspellings.
          </p>
        </div>
        <div className="hero-feature-card">
          <div className="hero-feature-icon">📨</div>
          <h3 className="hero-feature-title">Mass Inquiries</h3>
          <p className="hero-feature-desc">
            Send inquiries to multiple vendors simultaneously, saving time and effort.
          </p>
        </div>
        <div className="hero-feature-card">
          <div className="hero-feature-icon">⏱️</div>
          <h3 className="hero-feature-title">24h Responses</h3>
          <p className="hero-feature-desc">
            Vendors must respond within 24 hours, ensuring you get timely quotes.
          </p>
        </div>
      </div>

      <InstallPrompt />
    </div>
  );
}
