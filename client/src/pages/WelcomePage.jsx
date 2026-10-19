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
    return <Navigate to={user.role === 'seller' || user.role === 'provider' ? '/seller/dashboard' : '/dashboard'} replace />;
  }

  return (
    <div className="hero-section">
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'center' }}>
        <img
          src="/transparent_logo.png"
          alt="MarineStockHub"
          style={{
            maxHeight: '130px',
            maxWidth: 'min(440px, 90vw)',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 10px 25px rgba(37, 99, 235, 0.12))',
            animation: 'fadeIn 0.6s ease-out'
          }}
        />
      </div>

      <div className="hero-badge">
        <span>⚓</span> Marine Spare Parts Marketplace
      </div>

      <h1 className="hero-title">
        Welcome To <span className="hero-title-gradient">MarineStockHub</span>
      </h1>

      <p className="hero-subtitle">
        Your trusted marketplace for premium marine spare parts and equipment. Connect with verified global sellers instantly.
      </p>

      <div className="hero-cta">
        <Link to="/login" className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-xl)' }}>
          Enter MarineStockHub →
        </Link>
      </div>



      <InstallPrompt />
    </div>
  );
}
