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
      <Link to={user?.role === 'provider' ? '/provider/dashboard' : '/dashboard'} className="navbar-brand">
        <span className="navbar-logo">⚓</span>
        <span className="navbar-title">Vortex</span>
      </Link>

      <div className="navbar-links">
        {user && (
          <span className="nav-user">
            <span>{user.username}</span>
            <span className={`nav-user-badge ${user.role === 'provider' ? 'badge-provider' : 'badge-buyer'}`}>
              {user.role}
            </span>
          </span>
        )}
        <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
