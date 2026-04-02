import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InstallPrompt from '../components/InstallPrompt';

export default function WelcomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-container" style={{ backgroundColor: '#e0f2fe' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/dashboard'} replace />;
  }

  return (
    <>
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
        </div>
      </div>
      <div style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: "'Outfit', sans-serif",
        textAlign: 'center',
        padding: '2rem'
      }}>
      <div style={{ fontSize: '5rem', marginBottom: '1.5rem', animation: 'float 4s ease-in-out infinite' }}>⚓</div>
      <h1 style={{ 
        fontSize: '4.5rem', 
        fontWeight: '800', 
        marginBottom: '1rem',
        textShadow: '0 4px 20px rgba(0,0,0,0.2)',
        letterSpacing: '-1px'
      }}>Welcome To MarinTech</h1>
      
      <p style={{
        fontSize: '1.5rem',
        marginBottom: '3rem',
        fontWeight: '400',
        opacity: '0.9',
        maxWidth: '600px',
        lineHeight: '1.6'
      }}>Your trusted marketplace for premium marine spare parts and equipment.</p>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/login" className="btn btn-primary btn-lg" style={{ 
          padding: '1rem 3rem', 
          fontSize: '1.25rem',
          background: 'white',
          color: '#0077be',
          fontWeight: 'bold',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          borderRadius: '50px'
        }}>
          Enter Marketplace
        </Link>
      </div>
      <InstallPrompt />
    </div>
    </>
  );
}
