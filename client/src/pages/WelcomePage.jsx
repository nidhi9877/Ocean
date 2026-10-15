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
