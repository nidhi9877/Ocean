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
      <Link to={user?.role === 'seller' || user?.role === 'provider' ? '/seller/dashboard' : user?.role === 'management' ? '/management/dashboard' : '/buyer/dashboard'} className="navbar-brand">
        <img
          src="/transparent_logo.png"
          alt="MarineStockHub"
          style={{ height: '42px', width: 'auto', objectFit: 'contain', display: 'block' }}
        />
      </Link>

      <div className="navbar-links">
        {user && (
          <span className="nav-user">
            <span>{user.username}</span>
            <span className={`nav-user-badge ${user.role === 'seller' || user.role === 'provider' ? 'badge-seller' : user.role === 'management' ? 'badge-management' : 'badge-buyer'}`}>
              {user.role === 'provider' ? 'seller' : user.role}
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
