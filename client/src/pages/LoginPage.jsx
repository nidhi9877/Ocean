import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API = '/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await axios.post(`${API}/auth/login`, { username, password });
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

  const handleRegister = async (role) => {
    if (!username || !password) {
      toast.error('Please enter username and password first to register');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, { username, password, role });
      login(res.data.user, res.data.token);
      if (role === 'provider') {
        toast.success('Registration successful!');
        navigate('/provider/register');
      } else {
        toast.success('Registration successful!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>

      <div className="page-container">
        <div className="content-container">
          <div className="glass-card login-card">
            {/* Header */}
            <div className="login-header">
              <span className="login-icon">🚢</span>
              <h1 className="login-title">Vortex</h1>
              <p className="login-subtitle">Your trusted platform for marine spare parts</p>
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
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
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
    </>
  );
}
