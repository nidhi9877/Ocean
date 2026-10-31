import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { validateCompanyEmail } from '../utils/emailValidator';
import CountrySelect from '../components/CountrySelect';
import EmailOtpModal from '../components/EmailOtpModal';
import { TermsAcceptance } from '../components/Terms';

const API = '/api';

export default function BuyerRegister({ role = 'buyer' }) {
  const isReseller = role === 'reseller';
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    country: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [termsVersion, setTermsVersion] = useState(null); // version of the T&C the applicant accepted
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

    if (!formData.username || !formData.email || !formData.phone || !formData.country || !formData.password) {
      toast.error('Please fill in all fields including country');
      return;
    }

    // Company email validation
    const emailValidation = validateCompanyEmail(formData.email);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
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

    if (!termsVersion) {
      toast.error('Please read and accept the Terms & Conditions to continue.');
      return;
    }

    setLoading(true);
    try {
      await requestOtp();
      setOtpOpen(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: email a verification code. Throws with a user-facing message on failure.
  const requestOtp = async () => {
    try {
      const res = await axios.post(`${API}/auth/register/send-otp`, { email: formData.email.trim().toLowerCase(), username: formData.username.trim() });
      toast.success(res.data.message || 'Verification code sent.');
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Could not send verification code. Please try again.');
    }
  };

  // Step 2: submit the registration together with the code
  const completeRegistration = async (otp) => {
    try {
      await axios.post(`${API}/auth/register`, {
        username: formData.username,
        password: formData.password,
        role,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        country: formData.country,
        otp,
        acceptedTerms: true,
        termsVersion
      });
    } catch (err) {
      if (err.response?.data?.termsError) {
        // Terms changed since they were accepted — the applicant must review the new version
        setTermsVersion(null);
        setOtpOpen(false);
        toast.error(err.response.data.error);
      }
      throw new Error(err.response?.data?.error || 'Registration failed. Please try again.');
    }
    setOtpOpen(false);
    toast.success(isReseller
      ? 'Email verified! Your reseller account is pending management approval — once approved, recharge your wallet (min ₹500) to start sending enquiries.'
      : 'Email verified! Your account is pending management approval — we will email you once it is reviewed.', { duration: 7000 });
    navigate('/login');
  };

  return (
    <div className="register-layout">
      {/* Left Brand Panel */}
      <div className="register-side">
        <div className="login-brand-content">
          <span className="login-brand-icon">🚢</span>
          <h2 className="login-brand-title" style={{ fontSize: '2rem' }}>Welcome Aboard</h2>
          <p className="login-brand-subtitle">
            {isReseller
              ? 'Register as a reseller to source marine spare parts from verified sellers. Pay per enquiry from a prepaid wallet.'
              : 'Register as a buyer to discover and procure marine spare parts from verified sellers.'}
          </p>
          <div className="login-brand-features" style={{ marginTop: '2rem' }}>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">🔍</span>
              <span>Search thousands of spare parts</span>
            </div>
            <div className="login-brand-feature">
              <span className="login-brand-feature-icon">📨</span>
              <span>Send mass inquiries to sellers</span>
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
              <h2>{isReseller ? 'Reseller Registration' : 'Buyer Registration'}</h2>
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
                    <label className="form-label" htmlFor="email">
                      Company Email Address
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4rem', fontWeight: 'normal' }}>
                        (corporate email only)
                      </span>
                    </label>
                    <input
                      id="email" name="email" className="form-input" type="email"
                      placeholder="name@company.com" value={formData.email} onChange={handleChange} required
                    />
                    <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Personal emails (Gmail, Yahoo, Outlook, etc.) are not accepted.
                    </small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">Phone Number</label>
                    <input
                      id="phone" name="phone" className="form-input" type="tel"
                      placeholder="e.g. +91 9876543210" value={formData.phone} onChange={handleChange} required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="country">Country</label>
                    <CountrySelect
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Select country..."
                      required
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



              <div style={{ marginBottom: '1.25rem' }}>
                <TermsAcceptance value={termsVersion} onChange={setTermsVersion} role={role} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/login')}
                  style={{ flex: 1, minWidth: 160 }}
                  disabled={loading}
                >
                  ← Back to Login
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, minWidth: 220 }}
                  disabled={loading}
                >
                  {loading ? <span className="spinner"></span> : 'Verify Email & Register'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
      {otpOpen && (
        <EmailOtpModal
          email={formData.email.trim().toLowerCase()}
          onVerify={completeRegistration}
          onResend={requestOtp}
          onClose={() => setOtpOpen(false)}
        />
      )}
    </div>
  );
}
