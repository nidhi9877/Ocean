import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

const API = '/api';

export default function BuyerInquiries() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      const res = await axios.get(`${API}/buyer/inquiries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInquiries(res.data);
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
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

      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>My Inquiries 📨</h1>
            <p>Track the status of your product inquiries and contact vendors.</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary">
            &larr; Back to Search
          </Link>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '5rem auto' }}></div>
        ) : inquiries.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <p style={{ fontSize: '3rem' }}>📭</p>
            <h3>No inquiries sent</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Search for a product and send an inquiry to vendors.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {inquiries.map(inquiry => (
              <div key={inquiry.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{inquiry.product_name}</h3>
                    <span className={`badge ${inquiry.status === 'accepted' ? 'badge-buyer' : inquiry.status === 'rejected' ? 'badge-error' : 'badge-provider'}`} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {inquiry.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <span style={{ color: 'var(--teal-accent)' }}>🏭 Vendor Details</span>
                      <p style={{ margin: '0.2rem 0' }}><strong>Company:</strong> {inquiry.company_name}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Contact:</strong> {inquiry.provider_phone}</p>
                      <p style={{ margin: '0.2rem 0', opacity: 0.6 }}>Sent: {new Date(inquiry.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--teal-accent)' }}>📤 Your Request</span>
                      <p style={{ margin: '0.2rem 0' }}><strong>Destination:</strong> {inquiry.destination_location}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Part #:</strong> {inquiry.part_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
                  {inquiry.status === 'accepted' ? (
                    <div style={{ padding: '1rem', background: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.3)', borderRadius: '8px' }}>
                      <p style={{ color: '#00d4aa', fontWeight: 'bold', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>✅</span> Inquiry Accepted!
                      </p>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
                        The vendor is ready to proceed. Please contact them at their official email:
                      </p>
                      <a 
                        href={`mailto:${inquiry.provider_email}?subject=Inquiry for ${inquiry.product_name} - Destination ${inquiry.destination_location}`}
                        className="btn btn-primary btn-block"
                        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'var(--teal-accent)', color: '#091524' }}
                      >
                        ✉️ {inquiry.provider_email}
                      </a>
                    </div>
                  ) : inquiry.status === 'rejected' ? (
                     <div style={{ padding: '1rem', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '8px' }}>
                      <p style={{ color: '#ff6b6b', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>
                        ❌ Inquiry Rejected
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                       ⌛ Waiting for vendor to review...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
