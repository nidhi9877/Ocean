import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const hasText = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (!hasText || !hasNumber || !hasSpecial || password.length < 8) {
      setError('Password must be at least 8 characters and contain texts, numbers, and at least one special character');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/reset-password`, { token, password });
      toast.success(res.data.message || 'Password reset successful');
      navigate('/login');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Password reset failed. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-form-panel" style={{ flex: 1 }}>
        <div className="login-form-wrapper">
          <div className="glass-card login-card">
            <div className="login-header">
              <img
                src="/transparent_logo.png"
                alt="MarineStockHub"
                style={{ maxHeight: '52px', maxWidth: '240px', width: 'auto', margin: '0 auto 1.25rem', objectFit: 'contain' }}
              />
              <h1 className="login-title">Reset Password</h1>
              <p className="login-subtitle">Choose a new password for your account</p>
            </div>

            {!token ? (
              <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.9rem', lineHeight: 1.5 }}>
                This reset link is invalid. Please <Link to="/forgot-password">request a new one</Link>.
              </div>
            ) : (
              <>
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

                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-password">New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="new-password"
                        className="form-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter a new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
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
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
                    <input
                      id="confirm-password"
                      className="form-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter the new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                    {loading ? <span className="spinner"></span> : 'Reset Password'}
                  </button>
                </form>
              </>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem' }}>
              <Link to="/login" style={{ color: 'var(--primary, #2563eb)', fontWeight: 600 }}>← Back to Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
