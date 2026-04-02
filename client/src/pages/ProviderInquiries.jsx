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
                  {inquiry.status === 'pending' ? (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b' }}
                        onClick={() => updateStatus(inquiry.id, 'rejected')}
                      >
                        Reject
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, background: '#00d4aa', color: '#091524' }} 
                        onClick={() => updateStatus(inquiry.id, 'accepted')}
                      >
                        Accept
                      </button>
                    </>
                  ) : inquiry.status === 'accepted' ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '250px' }}>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,212,170,0.1)', color: '#00d4aa', borderRadius: '8px', fontWeight: 'bold' }}>
                        Accepted ✅
                      </div>
                      <a 
                        href={`https://wa.me/${inquiry.buyer_phone?.replace(/\D/g, '')}?text=${encodeURIComponent('Hello! Your booking has been done for ' + inquiry.product_name + ' (Destination: ' + inquiry.destination_location + ').')}`}
                        target="_blank" rel="noreferrer"
                        className="btn btn-primary"
                        style={{ background: '#25D366', color: '#fff', border: 'none', textAlign: 'center', textDecoration: 'none' }}
                      >
                        💬 WhatsApp Message
                      </a>
                    </div>
                  ) : (
                    <div style={{ flex: 1, textAlign: 'center', padding: '0.8rem', background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', borderRadius: '8px' }}>
                      Rejected ❌
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
