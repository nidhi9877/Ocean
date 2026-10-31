import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import CountrySelect from '../components/CountrySelect';
import EmailOtpModal from '../components/EmailOtpModal';
import { TermsAcceptance } from '../components/Terms';

const API = '/api';

export default function VendorRegister() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    companyName: '',
    companyType: '',
    address: '',
    country: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [termsVersion, setTermsVersion] = useState(null); // version of the T&C the applicant accepted
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

    if (!formData.username || !formData.email || !formData.phone || !formData.companyName || !formData.companyType || !formData.address || !formData.country || !formData.password) {
      toast.error('Please fill in all required fields including country');
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
        role: 'seller',
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        companyName: formData.companyName,
        companyType: formData.companyType,
        address: formData.address,
        country: formData.country,
        paymentMode: formData.paymentMode,
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
    toast.success('Email verified! Your account is pending management approval — we will email you once it is reviewed.', { duration: 6000 });
    navigate('/login');
  };

  return (
    <div className="register-layout">
      {/* Left Brand Panel */}
      <div className="register-side">
        <div className="login-brand-content">
          <h2 className="login-brand-title" style={{ fontSize: '2rem' }}>Become a Seller</h2>
          <p className="login-brand-subtitle">
            Join MarineStockHub to list your marine spare parts and reach buyers worldwide.
          </p>
          <div className="login-brand-features" style={{ marginTop: '2rem' }}>
            <div className="login-brand-feature">
              <span>List unlimited products</span>
            </div>
            <div className="login-brand-feature">
              <span>Receive direct buyer inquiries</span>
            </div>
            <div className="login-brand-feature">
              <span>Track inventory & analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="register-form-side">
        <div className="content-container-lg" style={{ width: '100%' }}>
          <div className="glass-card login-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="login-header">
              <h1 className="login-title">Seller Registration</h1>
              <p className="login-subtitle">Join as a seller to list and sell marine spare parts</p>
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-input" type="text" name="username" value={formData.username} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. +91 9876543210" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-input" type="text" name="companyName" value={formData.companyName} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Type</label>
                  <input className="form-input" type="text" name="companyType" value={formData.companyType} onChange={handleChange} placeholder="e.g. Manufacturer, Distributor" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <CountrySelect
                    name="country"
                    id="seller-country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Select country..."
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" type="text" name="address" value={formData.address} onChange={handleChange} placeholder="e.g. 123 Port Road, Suite 400" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" name="password" value={formData.password} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input className="form-input" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
              
              <TermsAcceptance value={termsVersion} onChange={setTermsVersion} role="seller" />
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? <span className="spinner"></span> : 'Verify Email & Register'}
              </button>
            </form>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
                Already have an account? <span style={{ color: 'var(--accent-primary)' }}>Sign in</span>
              </Link>
            </div>
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
