import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = '/api';

export default function BuyerRegister() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    imo_number: '',
    ship_name: '',
    ship_type: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
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
      setError('Passwords do not match');
      return;
    }

    if (!formData.username || !formData.email || !formData.phone || !formData.imo_number || !formData.ship_name || !formData.ship_type || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    // Strong password validation
    const hasText = /[A-Za-z]/.test(formData.password);
    const hasNumber = /\d/.test(formData.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);
    
    if (!hasText || !hasNumber || !hasSpecial || formData.password.length < 8) {
      setError('Password must be at least 8 characters and contain texts, numbers, and at least one special character');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API}/auth/register`, { 
        username: formData.username, 
        password: formData.password, 
        role: 'buyer',
        email: formData.email,
        phone: formData.phone,
        imo_number: formData.imo_number,
        ship_name: formData.ship_name,
        ship_type: formData.ship_type
      });
      
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
        </div>
      </div>

      <div className="page-container">
        <div className="content-container content-container-lg">
          <div className="glass-card provider-form-card">
            
            <div className="form-header text-center" style={{ textAlign: 'center' }}>
              <h2>Buyer Registration</h2>
              <p>Create your account to start purchasing marine spare parts.</p>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid #ff6b6b' }}>{error}</div>}

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

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">Phone Number</label>
                    <input
                      id="phone" name="phone" className="form-input" type="tel"
                      placeholder="+1 234 567 8900" value={formData.phone} onChange={handleChange} required
                    />
                  </div>
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

              <div className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon">🚢</span> Ship Details
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ship_name">Ship Name</label>
                    <input
                      id="ship_name" name="ship_name" className="form-input" type="text"
                      placeholder="e.g. Sea Voyager" value={formData.ship_name} onChange={handleChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="imo_number">IMO Number</label>
                    <input
                      id="imo_number" name="imo_number" className="form-input" type="text"
                      placeholder="e.g. 1234567" value={formData.imo_number} onChange={handleChange} required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="ship_type">Ship Type</label>
                  <select
                    id="ship_type" name="ship_type" className="form-select"
                    value={formData.ship_type} onChange={handleChange} required
                  >
                    <option value="" disabled>Select Ship Type</option>
                    <option value="Bulk Carrier">Bulk Carrier</option>
                    <option value="Container Ship">Container Ship</option>
                    <option value="Oil Tanker">Oil Tanker</option>
                    <option value="Chemical Tanker">Chemical Tanker</option>
                    <option value="Gas Carrier">Gas Carrier</option>
                    <option value="Ro-Ro Ship">Ro-Ro Ship</option>
                    <option value="Passenger Ship">Passenger/Cruise Ship</option>
                    <option value="Offshore Vessel">Offshore Vessel</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/login')}
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  Back to Login
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
    </>
  );
}
