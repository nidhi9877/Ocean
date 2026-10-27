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
      <video autoPlay loop muted playsInline className="bg-video">
        <source src="C:\Users\kunal\Ocean-main\vid.mp4" type="video/mp4" />
      </video>

      <img
        src="/transparent_logo.png"
        alt="MarineStockHub"
        className="hero-logo-img"
      />

      <h1 className="hero-title">
        <span className="hero-title-welcome">Welcome To</span>
        <span className="hero-title-gradient">MarineStockHub</span>
      </h1>

      <p className="hero-subtitle">
        Your trusted marketplace for premium marine spare parts and equipment. Connect with verified global sellers instantly.
      </p>

      <div className="hero-cta">
        <Link to="/login" className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-full)' }}>
          Enter MarineStockHub →
        </Link>
      </div>

      <InstallPrompt />
    </div>
  );
}
