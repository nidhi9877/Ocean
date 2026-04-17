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
            <h1>Incoming Inquiries 📨</h1>
            <p>Review and respond to messages from interested buyers.</p>
          </div>
          <Link to="/provider/dashboard" className="btn btn-secondary">
            &larr; Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="spinner" style={{ margin: '5rem auto' }}></div>
        ) : inquiries.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <p style={{ fontSize: '3rem' }}>📭</p>
            <h3>No inquiries yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>When buyers send inquiries for your products, they will appear here.</p>
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
                      <span style={{ color: 'var(--teal-accent)' }}>⛴️ Buyer Details</span>
                      <p style={{ margin: '0.2rem 0' }}><strong>Username:</strong> {inquiry.buyer_username}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Phone:</strong> {inquiry.buyer_phone}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Ship:</strong> {inquiry.ship_name} ({inquiry.ship_type})</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>IMO:</strong> {inquiry.imo_number}</p>
                    </div>
                    <div>
                      <span style={{ color: 'var(--teal-accent)' }}>📍 Request Details</span>
                      <p style={{ margin: '0.2rem 0' }}><strong>Destination:</strong> {inquiry.destination_location}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Part #:</strong> {inquiry.part_number || 'N/A'}</p>
                      <p style={{ margin: '0.2rem 0' }}><strong>Date:</strong> {new Date(inquiry.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '250px' }}>
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
                        <div style={{ flex: 1, textAlign: 'center', padding: '0.8rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: '8px' }}>
                          <span style={{fontSize: '0.8rem', display: 'block'}}>You haven't accepted the order ❌</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem' }}>
                          <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#ffb142', background: 'rgba(255, 177, 66, 0.1)', padding: '0.3rem', borderRadius: '4px' }}>
                            ⏳ {h}h {m}m {s}s
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ flex: 1, background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b', padding: '0.5rem' }}
                              onClick={() => updateStatus(inquiry.id, 'rejected')}
                            >
                              Reject
                            </button>
                            <button 
                              className="btn btn-primary" 
                              style={{ flex: 1, background: '#00d4aa', color: '#091524', padding: '0.5rem' }} 
                              onClick={() => updateStatus(inquiry.id, 'accepted')}
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      );
                    } else if (inquiry.status === 'accepted') {
                      return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '250px' }}>
                        <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,212,170,0.1)', color: '#00d4aa', borderRadius: '8px', fontWeight: 'bold' }}>
                          Accepted ✅
                        </div>
                        <a 
                          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${inquiry.buyer_email}&su=${encodeURIComponent('Booking Confirmation for ' + inquiry.product_name)}&body=${encodeURIComponent(`Dear ${inquiry.buyer_username},\n\nThis is an official confirmation regarding your inquiry.\n\n--- BOOKING DETAILS ---\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\nDestination: ${inquiry.destination_location}\n\n--- VESSEL DETAILS ---\nShip Name: ${inquiry.ship_name} (${inquiry.ship_type})\nIMO Number: ${inquiry.imo_number}\n\nWe are prepared to proceed with the fulfillment of this order. Please reply to this email so we can finalize the arrangements.\n\nBest regards,\nVendor Team`)}`}
                          target="_blank" rel="noreferrer"
                          className="btn btn-primary"
                          style={{ background: 'var(--teal-accent)', color: '#091524', border: 'none', textAlign: 'center', textDecoration: 'none', padding: '0.8em', lineHeight: '1.4' }}
                        >
                          ✉️ Email Buyer<br/><span style={{ fontSize: '0.85em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
                        </a>
                      </div>
                      );
                    } else {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '250px' }}>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', borderRadius: '8px', fontWeight: 'bold' }}>
                            Rejected ❌
                          </div>
                          <a 
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${inquiry.buyer_email}&su=${encodeURIComponent('Update on your Inquiry for ' + inquiry.product_name)}&body=${encodeURIComponent(`Dear ${inquiry.buyer_username},\n\nThank you for reaching out to us.\n\nRegarding your inquiry for:\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\n\nUnfortunately, we are unable to fulfill this request at the moment. We hope to assist you with other requirements in the future.\n\nBest regards,\nVendor Team`)}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid #ff6b6b', textAlign: 'center', textDecoration: 'none', padding: '0.8em', lineHeight: '1.4' }}
                          >
                            ✉️ Notify Buyer<br/><span style={{ fontSize: '0.85em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
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
