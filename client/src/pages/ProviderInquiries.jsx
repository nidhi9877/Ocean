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
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [emailType, setEmailType] = useState('accepted'); // 'accepted' or 'rejected'
  const [emailData, setEmailData] = useState({ cc: '', bcc: '', subject: '', body: '' });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const openComposeModal = (inquiry, type) => {
    setSelectedInquiry(inquiry);
    setEmailType(type);
    
    let subject = '';
    let body = '';
    
    if (type === 'accepted') {
      subject = `Booking Confirmation for ${inquiry.product_name}`;
      body = `Dear ${inquiry.buyer_username},\n\nThis is an official confirmation regarding your inquiry.\n\n--- BOOKING DETAILS ---\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\nDestination: ${inquiry.destination_location}\n\n--- VESSEL DETAILS ---\nShip Name: ${inquiry.ship_name} (${inquiry.ship_type})\nIMO Number: ${inquiry.imo_number}\n\nWe are prepared to proceed with the fulfillment of this order. Please reply to this email so we can finalize the arrangements.\n\nBest regards,\nVendor Team`;
    } else {
      subject = `Update on your Inquiry for ${inquiry.product_name}`;
      body = `Dear ${inquiry.buyer_username},\n\nThank you for reaching out to us.\n\nRegarding your inquiry for:\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\n\nUnfortunately, we are unable to fulfill this request at the moment. We hope to assist you with other requirements in the future.\n\nBest regards,\nVendor Team`;
    }
    
    setShowCc(!!inquiry.cc);
    setShowBcc(!!inquiry.bcc);
    setEmailData({
      cc: inquiry.cc || '',
      bcc: inquiry.bcc || '',
      subject,
      body
    });
    setShowComposeModal(true);
  };

  const handleOpenGmail = () => {
    if (!selectedInquiry) return;
    const to = selectedInquiry.buyer_email || '';
    const cc = emailData.cc ? `&cc=${encodeURIComponent(emailData.cc.trim())}` : '';
    const bcc = emailData.bcc ? `&bcc=${encodeURIComponent(emailData.bcc.trim())}` : '';
    
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}${cc}${bcc}`;
    
    window.open(gmailLink, '_blank', 'noreferrer');
    setShowComposeModal(false);
  };

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
                        <button 
                          type="button"
                          onClick={() => openComposeModal(inquiry, 'accepted')}
                          className="btn btn-primary"
                          style={{ textAlign: 'center', cursor: 'pointer', border: 'none', display: 'block', width: '100%', padding: '0.55rem' }}
                        >
                          ✉️ Email Buyer<br/><span style={{ fontSize: '0.8em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
                        </button>
                      </div>
                      );
                    } else {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', border: '1px solid var(--danger-border)' }}>
                            Rejected ❌
                          </div>
                          <button 
                            type="button"
                            onClick={() => openComposeModal(inquiry, 'rejected')}
                            className="btn btn-outline"
                            style={{ textAlign: 'center', cursor: 'pointer', display: 'block', width: '100%', padding: '0.55rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          >
                            ✉️ Notify Buyer<br/><span style={{ fontSize: '0.8em', opacity: 0.9 }}>{inquiry.buyer_email}</span>
                          </button>
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

      {/* ═══ EMAIL COMPOSER MODAL ═══ */}
      {showComposeModal && selectedInquiry && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s' }}
             onClick={() => setShowComposeModal(false)}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px 12px 0 0', 
            boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1)', 
            width: 600, 
            maxWidth: '94vw', 
            height: '500px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            fontFamily: 'Arial, sans-serif',
            color: '#1f1f1f',
            border: '1px solid #ccc',
          }} onClick={e => e.stopPropagation()}>

            {/* Header: light gray/blueish background, "New Message" on left, controls on right */}
            <div style={{ 
              background: '#f2f6fc', 
              padding: '10px 16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              userSelect: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f' }}>New Message</span>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{ cursor: 'pointer', fontSize: '16px', color: '#5f6368' }}>−</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', color: '#5f6368' }}>⤢</span>
                <span onClick={() => setShowComposeModal(false)} style={{ cursor: 'pointer', fontSize: '16px', color: '#5f6368', fontWeight: 'bold' }}>✕</span>
              </div>
            </div>

            {/* Form Fields container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#fff' }}>
              
              {/* To field row */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 16px', 
                borderBottom: '1px solid #f2f2f2',
                position: 'relative'
              }}>
                <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>To</span>
                <input 
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: '14px', 
                    color: '#202124',
                    background: 'transparent',
                    width: '100%'
                  }} 
                  value={`${selectedInquiry.buyer_username} <${selectedInquiry.buyer_email}>`} 
                  disabled 
                />
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#5f6368', userSelect: 'none' }}>
                  {!showCc && (
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                      onClick={() => setShowCc(true)}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Cc
                    </span>
                  )}
                  {!showBcc && (
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                      onClick={() => setShowBcc(true)}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Bcc
                    </span>
                  )}
                </div>
              </div>

              {/* CC field row */}
              {showCc && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f2f2f2'
                }}>
                  <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>Cc</span>
                  <input 
                    style={{ 
                      flex: 1, 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '14px', 
                      color: '#202124',
                      width: '100%'
                    }} 
                    placeholder="Cc email address"
                    value={emailData.cc} 
                    onChange={e => setEmailData(prev => ({ ...prev, cc: e.target.value }))} 
                  />
                  <span 
                    onClick={() => setShowCc(false)} 
                    style={{ cursor: 'pointer', color: '#bdc1c6', fontSize: '14px', marginLeft: '6px' }}
                  >
                    ✕
                  </span>
                </div>
              )}

              {/* BCC field row */}
              {showBcc && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f2f2f2'
                }}>
                  <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>Bcc</span>
                  <input 
                    style={{ 
                      flex: 1, 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '14px', 
                      color: '#202124',
                      width: '100%'
                    }} 
                    placeholder="Bcc email address"
                    value={emailData.bcc} 
                    onChange={e => setEmailData(prev => ({ ...prev, bcc: e.target.value }))} 
                  />
                  <span 
                    onClick={() => setShowBcc(false)} 
                    style={{ cursor: 'pointer', color: '#bdc1c6', fontSize: '14px', marginLeft: '6px' }}
                  >
                    ✕
                  </span>
                </div>
              )}

              {/* Subject field row */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 16px', 
                borderBottom: '1px solid #f2f2f2'
              }}>
                <input 
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: '14px', 
                    color: '#202124',
                    width: '100%'
                  }} 
                  placeholder="Subject"
                  value={emailData.subject} 
                  onChange={e => setEmailData(prev => ({ ...prev, subject: e.target.value }))} 
                />
              </div>

              {/* Message Body Field */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <textarea 
                  style={{ 
                    width: '100%', 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    resize: 'none',
                    fontSize: '14px', 
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.5',
                    color: '#202124',
                    background: '#fff'
                  }} 
                  placeholder="Say something..."
                  value={emailData.body} 
                  onChange={e => setEmailData(prev => ({ ...prev, body: e.target.value }))} 
                />
              </div>

            </div>

            {/* Footer Toolbar: Send button & icons */}
            <div style={{ 
              padding: '12px 16px', 
              background: '#fff', 
              borderTop: '1px solid #f2f2f2',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Blue pill Send button with dropdown */}
                <div style={{ display: 'flex', borderRadius: '24px', overflow: 'hidden', background: '#0b57d0' }}>
                  <button 
                    onClick={handleOpenGmail}
                    style={{ 
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#084bb8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Send
                  </button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
                  <button 
                    style={{ 
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#084bb8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '10px' }}>▼</span>
                  </button>
                </div>

                {/* Toolbar icons matching Gmail */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#444746' }}>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Formatting options">Aa</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Attach files">📎</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert link">🔗</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert emoji">😊</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert files using Drive">📁</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert photo">📷</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Toggle confidential mode">🔒</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert signature">✍️</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="More options">⋮</span>
                </div>
              </div>

              {/* Trash icon */}
              <button 
                onClick={() => setShowComposeModal(false)}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#444746',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f2f2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                title="Discard draft"
              >
                🗑️
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
