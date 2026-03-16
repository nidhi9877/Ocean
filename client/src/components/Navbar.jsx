import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="navbar-logo">⚓</span>
        <span className="navbar-title">Marine Marketplace</span>
      </Link>

      <div className="navbar-links">
        {user ? (
          <>
            <div className="nav-user">
              <span>👤 {user.username}</span>
              <span className={`nav-user-badge ${user.role === 'provider' ? 'badge-provider' : 'badge-buyer'}`}>
                {user.role}
              </span>
            </div>
            {user.role === 'buyer' && (
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
            )}
            {user.role === 'provider' && (
              <Link to="/provider/dashboard" className="nav-link">My Products</Link>
            )}
            <button onClick={handleLogout} className="btn btn-sm btn-secondary">
              Logout
            </button>
          </>
        ) : (
          <Link to="/" className="nav-link">Login</Link>
        )}
      </div>
    </nav>
  );
}
