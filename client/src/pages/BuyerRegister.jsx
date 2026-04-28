import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API = '/api';

export default function BuyerRegister() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!formData.username || !formData.email || !formData.phone || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!formData.phone.trim().startsWith('+')) {
      toast.error('Please enter your phone number with the country code (e.g., +91).');
      return;
    }

    // Strong password validation
    const hasText = /[A-Za-z]/.test(formData.password);
    const hasNumber = /\d/.test(formData.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);
    
    if (!hasText || !hasNumber || !hasSpecial || formData.password.length < 8) {
      toast.error('Password must be at least 8 characters and contain texts, numbers, and at least one special character');
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API}/auth/register`, { 
        username: formData.username, 
        password: formData.password, 
        role: 'buyer',
        email: formData.email,
        phone: formData.phone
      });
      
      login(res.data.user, res.data.token);
      toast.success('Registration successful! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-layout">
      {/* Left Brand Panel */}
      <div className="register-side">
        <div className="login-brand-content">
          <span className="login-brand-icon">🚢</span>
          <h2 className="login-brand-title" style={{ fontSize: '2rem' }}>Welcome Aboard</h2>
          <p className="login-brand-subtitle">
            Register as a buyer to discover and procure marine spare parts from verified vendors.
          </p>
          <div className="login-brand-features" style={{ marginTop: '2rem' }}>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">🔍</span>
              <span>Search thousands of spare parts</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">📨</span>
              <span>Send mass inquiries to vendors</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">⏱️</span>
              <span>Get responses within 24 hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="register-form-side">
        <div className="content-container-lg" style={{ width: '100%' }}>
          <div className="glass-card provider-form-card" style={{ maxWidth: '640px', margin: '0 auto' }}>
            
            <div className="form-header" style={{ textAlign: 'center' }}>
              <h2>Buyer Registration</h2>
              <p>Create your account to start purchasing marine spare parts.</p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon">👤</span> Account Details
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="username">Username</label>
                    <input
                      id="username" name="username" className="form-input" type="text"
                      placeholder="e.g. jdoe_marine" value={formData.username} onChange={handleChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">Email Address</label>
                    <input
                      id="email" name="email" className="form-input" type="email"
                      placeholder="john@example.com" value={formData.email} onChange={handleChange} required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number</label>
                  <input
                    id="phone" name="phone" className="form-input" type="tel"
                    placeholder="e.g. +91 9876543210" value={formData.phone} onChange={handleChange} required
                  />
                </div>

                <div className="form-row">
                   <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                      id="password" name="password" className="form-input" type="password"
                      placeholder="Create a strong password" value={formData.password} onChange={handleChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                    <input
                      id="confirmPassword" name="confirmPassword" className="form-input" type="password"
                      placeholder="Repeat your password" value={formData.confirmPassword} onChange={handleChange} required
                    />
                  </div>
                </div>
              </div>



              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/login')}
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  ← Back to Login
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? <span className="spinner"></span> : 'Register as Buyer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
