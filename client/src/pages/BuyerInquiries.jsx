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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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
      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>My Inquiries 📨</h1>
            <p>Track the status of your product inquiries and contact vendors.</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary">
            ← Back to Search
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">📭</span>
            <h3>No inquiries sent</h3>
            <p>Search for a product and send an inquiry to vendors.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {inquiries.map(inquiry => (
              <div key={inquiry.id} className="glass-card inquiry-card" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{inquiry.product_name}</h3>
                    <span className={`nav-user-badge ${inquiry.status === 'accepted' ? 'badge-buyer' : inquiry.status === 'rejected' ? 'badge-error' : 'badge-provider'}`}>
                      {inquiry.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="inquiry-details">
                    <div>
                      <div className="inquiry-section-label">🏭 Vendor Details</div>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Company:</strong> {inquiry.company_name}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Contact:</strong> {inquiry.provider_phone}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sent: {new Date(inquiry.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <div className="inquiry-section-label">📤 Your Request</div>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Destination:</strong> {inquiry.destination_location}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Part #:</strong> {inquiry.part_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="inquiry-actions">
                  {(() => {
                    const maxTime = 24 * 60 * 60 * 1000;
                    const timePassed = now - new Date(inquiry.created_at).getTime();
                    const timeLeft = maxTime - timePassed;
                    const isExpired = timeLeft <= 0;
                    
                    const h = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                    const m = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)));
                    const s = Math.max(0, Math.floor((timeLeft % (1000 * 60)) / 1000));

                    if (inquiry.status === 'accepted') {
                      return (
                        <div style={{ padding: '1rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)' }}>
                          <p style={{ color: 'var(--success)', fontWeight: 'bold', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>✅</span> Inquiry Accepted!
                          </p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                            The vendor is ready to proceed. Contact them:
                          </p>
                          <a 
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${inquiry.provider_email}&su=${encodeURIComponent('Follow-up on Inquiry for ' + inquiry.product_name)}&body=${encodeURIComponent(`Hello ${inquiry.company_name} Team,\n\nI am writing to follow up on my accepted inquiry.\n\n--- REQUEST DETAILS ---\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\nRequired Destination: ${inquiry.destination_location}\n\nPlease let me know what further information or documentation is required from my side to finalize this booking.\n\nBest regards,\nMarine Market Buyer`)}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary btn-block"
                            style={{ textDecoration: 'none', textAlign: 'center', lineHeight: '1.4' }}
                          >
                            ✉️ Email Vendor<br/><span style={{ fontSize: '0.8em', opacity: 0.9 }}>{inquiry.provider_email}</span>
                          </a>
                        </div>
                      );
                    } else if (inquiry.status === 'rejected') {
                      return (
                         <div style={{ padding: '1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                          <p style={{ color: 'var(--danger)', fontWeight: 'bold', margin: 0 }}>
                            ❌ Inquiry Rejected
                          </p>
                        </div>
                      );
                    } else {
                      return isExpired ? (
                        <div style={{ padding: '1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                          <p style={{ color: 'var(--danger)', fontWeight: 'bold', margin: 0 }}>
                            ❌ No response
                          </p>
                        </div>
                      ) : (
                        <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                           ⌛ Waiting for vendor...<br/><br/>
                           <span style={{ color: 'var(--warning)', fontWeight: 'bold', background: 'var(--warning-bg)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                             ⏳ {h}h {m}m {s}s
                           </span>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
