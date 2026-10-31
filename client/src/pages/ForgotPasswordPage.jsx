import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your username or email');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { identifier: identifier.trim() });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong. Please try again.');
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
              <h1 className="login-title">Forgot Password</h1>
              <p className="login-subtitle">
                {sent
                  ? 'Check your inbox for the reset link'
                  : "Enter your username or registered email and we'll send you a reset link"}
              </p>
            </div>

            {sent ? (
              <div style={{
                padding: '1rem',
                marginBottom: '1.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#16a34a',
                fontSize: '0.9rem',
                lineHeight: 1.5
              }}>
                If an account matches the details you entered, a password reset link has been sent to its registered email. The link expires in 30 minutes. Don't forget to check your spam folder.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="identifier">Username or Email</label>
                  <input
                    id="identifier"
                    className="form-input"
                    type="text"
                    placeholder="Enter your username or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Send Reset Link'}
                </button>
              </form>
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
