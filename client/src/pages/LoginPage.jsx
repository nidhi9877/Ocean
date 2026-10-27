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
      if (res.data.user.role === 'seller' || res.data.user.role === 'provider') {
        toast.success(`Welcome back, ${res.data.user.username}!`);
        navigate('/seller/dashboard');
      } else if (res.data.user.role === 'management') {
        toast.success(`Welcome back, ${res.data.user.username}!`);
        navigate('/management/dashboard');
      } else {
        toast.success(`Welcome back, ${res.data.user.username}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Login failed. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      {/* Left Brand Panel */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/transparent_logo.png"
              alt="MarineStockHub"
              style={{
                maxHeight: '120px',
                maxWidth: 'min(360px, 90%)',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 10px 24px rgba(37, 99, 235, 0.15))'
              }}
            />
          </div>
          <p className="login-brand-subtitle">
            The premier B2B marketplace connecting marine vessel operators with verified spare parts sellers worldwide.
          </p>
          <div className="login-brand-features">
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">🔍</span>
              <span>Smart fuzzy search with typo tolerance</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">📨</span>
              <span>Mass inquiry system to multiple sellers</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">⏱️</span>
              <span>24-hour guaranteed seller response time</span>
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
              <img
                src="/transparent_logo.png"
                alt="MarineStockHub"
                className="login-mobile-logo"
                style={{
                  maxHeight: '52px',
                  maxWidth: '240px',
                  width: 'auto',
                  margin: '0 auto 1.25rem',
                  objectFit: 'contain'
                }}
              />
              <span className="login-icon">🚢</span>
              <h1 className="login-title">Sign In</h1>
              <p className="login-subtitle">Access your MarineStockHub account</p>
            </div>

            {error && (
              <div style={{
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.88rem',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

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
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--primary, #2563eb)'
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="login-divider">New here? Register as</div>

            {/* Role Selection Buttons */}
            <div className="role-buttons">
              <button
                type="button"
                className="role-btn"
                onClick={() => navigate('/seller/register')}
                disabled={loading}
              >
                <span className="role-btn-icon">🏭</span>
                <span className="role-btn-label">Seller</span>
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
