import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API = '/api';

export default function VendorRegister() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    companyName: '',
    companyType: '',
    address: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!formData.username || !formData.email || !formData.phone || !formData.companyName || !formData.companyType || !formData.address || !formData.password) {
      toast.error('Please fill in all required fields');
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
      // 1. Register User Profile
      const res = await axios.post(`${API}/auth/register`, {
        username: formData.username,
        password: formData.password,
        role: 'provider',
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName,
        companyType: formData.companyType,
        address: formData.address
      });
      
      login(res.data.user, res.data.token);
      toast.success('Registration successful! Welcome to Vortex.');
      
      // Auto redirect to provider dashboard
      navigate('/provider/dashboard');
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
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
        </div>
      </div>

      <div className="page-container">
        <div className="content-container">
          <div className="glass-card login-card" style={{ maxWidth: '600px' }}>
            <div className="login-header">
              <span className="login-icon">🏭</span>
              <h1 className="login-title">Vendor Registration</h1>
              <p className="login-subtitle">Join as a vendor to sell marine spare parts</p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" type="text" name="username" value={formData.username} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. +91 9876543210" required />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="form-input" type="text" name="companyName" value={formData.companyName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Company Type</label>
                <input className="form-input" type="text" name="companyType" value={formData.companyType} onChange={handleChange} placeholder="e.g. Manufacturer, Distributor" required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" type="text" name="address" value={formData.address} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" name="password" value={formData.password} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
              </div>
              
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? <span className="spinner"></span> : 'Submit'}
              </button>
            </form>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                Already have an account? Login here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
