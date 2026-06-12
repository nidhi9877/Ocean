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
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [emailData, setEmailData] = useState({ cc: '', bcc: '', subject: '', body: '' });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const openComposeModal = (inquiry) => {
    setSelectedInquiry(inquiry);
    const subject = `Follow-up on Inquiry for ${inquiry.product_name}`;
    const body = `Hello ${inquiry.company_name} Team,\n\nI am writing to follow up on my accepted inquiry.\n\n--- REQUEST DETAILS ---\nProduct: ${inquiry.product_name}\nPart Number: ${inquiry.part_number || 'N/A'}\nRequired Destination: ${inquiry.destination_location}\n\nPlease let me know what further information or documentation is required from my side to finalize this booking.\n\nBest regards,\nMarine Market Buyer`;
    
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

  const handleSendEmail = () => {
    if (!selectedInquiry) return;
    const to = selectedInquiry.provider_email || '';
    const cc = emailData.cc ? `&cc=${encodeURIComponent(emailData.cc.trim())}` : '';
    const bcc = emailData.bcc ? `&bcc=${encodeURIComponent(emailData.bcc.trim())}` : '';
    
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}${cc}${bcc}`;
    
    window.location.href = mailtoLink;
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
              <div key={inquiry.id} className="glass-card inquiry-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', padding: '1.25rem 1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{inquiry.product_name}</h3>
                    <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'rgba(37,99,235,0.06)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(37,99,235,0.1)' }}>
                      Part #: {inquiry.part_number || 'N/A'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      <span>🏭</span> <strong>Vendor:</strong> {inquiry.company_name} ({inquiry.provider_phone})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      <span>📍</span> <strong>Destination:</strong> {inquiry.destination_location}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <span>📅</span> <strong>Sent:</strong> {new Date(inquiry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', flexShrink: 0 }}>
                  <span className={`nav-user-badge ${inquiry.status === 'accepted' ? 'badge-buyer' : inquiry.status === 'rejected' ? 'badge-error' : 'badge-provider'}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {inquiry.status.toUpperCase()}
                  </span>
                  
                  <div className="inquiry-actions" style={{ minWidth: '160px' }}>
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
                           <div style={{ padding: '0.5rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)' }}>
                             <p style={{ color: 'var(--success)', fontWeight: 'bold', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                               <span>✅</span> Accepted!
                             </p>
                              <button 
                                type="button"
                                onClick={() => openComposeModal(inquiry)}
                                className="btn btn-primary btn-block"
                                style={{ textDecoration: 'none', textAlign: 'center', padding: '0.35rem 0.5rem', fontSize: '0.78rem', lineHeight: '1.2', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
                              >
                                ✉️ Email Vendor
                              </button>
                           </div>
                         );
                       } else if (inquiry.status === 'rejected') {
                         return (
                            <div style={{ padding: '0.5rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                             <p style={{ color: 'var(--danger)', fontWeight: 'bold', margin: 0, fontSize: '0.85rem' }}>
                               ❌ Rejected
                             </p>
                           </div>
                         );
                       } else {
                         return isExpired ? (
                           <div style={{ padding: '0.5rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                             <p style={{ color: 'var(--danger)', fontWeight: 'bold', margin: 0, fontSize: '0.85rem' }}>
                               ❌ No response
                             </p>
                           </div>
                         ) : (
                           <div style={{ padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                              ⌛ Waiting...<br/>
                              <span style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                ⏳ {h}h {m}m
                              </span>
                           </div>
                         );
                       }
                    })()}
                  </div>
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
                  value={`${selectedInquiry.company_name} <${selectedInquiry.provider_email}>`} 
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
                    onClick={handleSendEmail}
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
