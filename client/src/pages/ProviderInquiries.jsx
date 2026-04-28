import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

const API = '/api';

export default function ProviderInquiries() {
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
      const res = await axios.get(`${API}/provider/inquiries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInquiries(res.data);
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/provider/inquiries/${id}/status`, 
        { status }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update locally
      setInquiries(inquiries.map(i => i.id === id ? { ...i, status } : i));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Incoming Inquiries 📨</h1>
            <p>Review and respond to messages from interested buyers.</p>
          </div>
          <Link to="/provider/dashboard" className="btn btn-secondary">
            ← Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">📭</span>
            <h3>No inquiries yet</h3>
            <p>When buyers send inquiries for your products, they will appear here.</p>
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
                      <div className="inquiry-section-label">⛴️ Buyer Details</div>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Username:</strong> {inquiry.buyer_username}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Phone:</strong> {inquiry.buyer_phone}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Ship:</strong> {inquiry.ship_name} ({inquiry.ship_type})</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>IMO:</strong> {inquiry.imo_number}</p>
                    </div>
                    <div>
                      <div className="inquiry-section-label">📍 Request Details</div>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Destination:</strong> {inquiry.destination_location}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Part #:</strong> {inquiry.part_number || 'N/A'}</p>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}><strong>Date:</strong> {new Date(inquiry.created_at).toLocaleDateString()}</p>
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

                    if (inquiry.status === 'pending') {
                      return isExpired ? (
                        <div style={{ textAlign: 'center', padding: '0.8rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontSize: '0.85rem' }}>You haven't accepted the order ❌</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem' }}>
                          <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--warning)', background: 'var(--warning-bg)', padding: '0.3rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                            ⏳ {h}h {m}m {s}s
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-danger" 
                              style={{ flex: 1, padding: '0.5rem' }}
                              onClick={() => updateStatus(inquiry.id, 'rejected')}
                            >
                              Reject
                            </button>
                            <button 
                              className="btn btn-primary" 
                              style={{ flex: 1, padding: '0.5rem' }} 
                              onClick={() => updateStatus(inquiry.id, 'accepted')}
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      );
                    } else if (inquiry.status === 'accepted') {
                      return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', border: '1px solid var(--success-border)' }}>
                          Accepted ✅
                        </div>
                        <a 
                          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${inquiry.buyer_email}&su=${encodeURIComponent('Booking Confirmation for ' + inquiry.product_name)}&body=${encodeURIComponent(`Dear ${inquiry.buyer_username},\n\nThis is an official confirmation regarding your inquiry.\n\n--- BOOKING DETAILS ---\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\nDestination: ${inquiry.destination_location}\n\n--- VESSEL DETAILS ---\nShip Name: ${inquiry.ship_name} (${inquiry.ship_type})\nIMO Number: ${inquiry.imo_number}\n\nWe are prepared to proceed with the fulfillment of this order. Please reply to this email so we can finalize the arrangements.\n\nBest regards,\nVendor Team`)}`}
                          target="_blank" rel="noreferrer"
                          className="btn btn-primary"
                          style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '1.4' }}
                        >
                          ✉️ Email Buyer<br/><span style={{ fontSize: '0.8em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
                        </a>
                      </div>
                      );
                    } else {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', border: '1px solid var(--danger-border)' }}>
                            Rejected ❌
                          </div>
                          <a 
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${inquiry.buyer_email}&su=${encodeURIComponent('Update on your Inquiry for ' + inquiry.product_name)}&body=${encodeURIComponent(`Dear ${inquiry.buyer_username},\n\nThank you for reaching out to us.\n\nRegarding your inquiry for:\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\n\nUnfortunately, we are unable to fulfill this request at the moment. We hope to assist you with other requirements in the future.\n\nBest regards,\nVendor Team`)}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-outline"
                            style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '1.4', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          >
                            ✉️ Notify Buyer<br/><span style={{ fontSize: '0.8em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
                          </a>
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
