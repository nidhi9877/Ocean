import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API = '/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { username: username.trim(), password });
      login(res.data.user, res.data.token);
      if (res.data.user.role === 'provider') {
        toast.success(`Welcome back, ${res.data.user.username}!`);
        navigate('/provider/dashboard');
      } else {
        toast.success(`Welcome back, ${res.data.user.username}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      {/* Left Brand Panel */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <span className="login-brand-icon">⚓</span>
          <h1 className="login-brand-title">Vortex</h1>
          <p className="login-brand-subtitle">
            The premier B2B marketplace connecting marine vessel operators with verified spare parts vendors worldwide.
          </p>
          <div className="login-brand-features">
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">🔍</span>
              <span>Smart fuzzy search with typo tolerance</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">📨</span>
              <span>Mass inquiry system to multiple vendors</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">⏱️</span>
              <span>24-hour guaranteed vendor response time</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">🌍</span>
              <span>Global network of verified suppliers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="glass-card login-card">
            {/* Header */}
            <div className="login-header">
              <span className="login-icon">🚢</span>
              <h1 className="login-title">Sign In</h1>
              <p className="login-subtitle">Access your Vortex account</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <input
                  id="username"
                  className="form-input"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : '🔑 Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="login-divider">New here? Register as</div>

            {/* Role Selection Buttons */}
            <div className="role-buttons">
              <button
                type="button"
                className="role-btn"
                onClick={() => navigate('/vendor/register')}
                disabled={loading}
              >
                <span className="role-btn-icon">🏭</span>
                <span className="role-btn-label">Vendor</span>
                <span className="role-btn-desc">Sell spare parts</span>
              </button>

              <button
                type="button"
                className="role-btn"
                onClick={() => navigate('/buyer/register')}
                disabled={loading}
              >
                <span className="role-btn-icon">🛒</span>
                <span className="role-btn-label">Buyer</span>
                <span className="role-btn-desc">Browse & purchase</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
