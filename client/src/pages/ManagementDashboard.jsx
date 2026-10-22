import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';

const API = '/api';

const statusStyle = (status) => {
  if (status === 'approved') return { background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 };
  if (status === 'pending')  return { background: 'rgba(234,179,8,0.12)',  color: '#eab308', border: '1px solid rgba(234,179,8,0.3)',  borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 };
  if (status === 'rejected') return { background: 'rgba(239,68,68,0.12)',  color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',  borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 600 };
  return {};
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

export default function ManagementDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [stats, setStats] = useState({});
  const [pendingSellers, setPendingSellers] = useState([]);
  const [allSellers, setAllSellers] = useState([]);
  const [allBuyers, setAllBuyers] = useState([]);

  const authH = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, sellersRes, buyersRes] = await Promise.all([
        axios.get(`${API}/management/stats`, authH),
        axios.get(`${API}/management/pending-sellers`, authH),
        axios.get(`${API}/management/all-sellers`, authH),
        axios.get(`${API}/management/all-buyers`, authH),
      ]);
      setStats(statsRes.data);
      setPendingSellers(pendingRes.data);
      setAllSellers(sellersRes.data);
      setAllBuyers(buyersRes.data);
    } catch (err) {
      console.error('Failed to fetch management data:', err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sellerId) => {
    setActionLoading(sellerId);
    try {
      await axios.put(`${API}/management/sellers/${sellerId}/approve`, {}, authH);
      toast.success('Seller approved successfully.');
      setPendingSellers(prev => prev.filter(p => p.id !== sellerId));
      setAllSellers(prev => prev.map(s => s.id === sellerId ? { ...s, status: 'approved' } : s));
      setStats(prev => ({ ...prev, pendingSellers: prev.pendingSellers - 1, approvedSellers: prev.approvedSellers + 1 }));
    } catch {
      toast.error('Failed to approve seller.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (sellerId) => {
    if (!window.confirm('Are you sure you want to reject this seller application?')) return;
    setActionLoading(sellerId);
    try {
      await axios.put(`${API}/management/sellers/${sellerId}/reject`, {}, authH);
      toast.success('Seller rejected.');
      setPendingSellers(prev => prev.filter(p => p.id !== sellerId));
      setAllSellers(prev => prev.map(s => s.id === sellerId ? { ...s, status: 'rejected' } : s));
      setStats(prev => ({ ...prev, pendingSellers: prev.pendingSellers - 1, rejectedSellers: prev.rejectedSellers + 1 }));
    } catch {
      toast.error('Failed to reject seller.');
    } finally {
      setActionLoading(null);
    }
  };

  const th = { padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
  const td = { padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' };

  const tabs = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'pending',   label: `⏳ Pending${pendingSellers.length > 0 ? ` (${pendingSellers.length})` : ''}` },
    { id: 'sellers',   label: `🏭 Sellers (${allSellers.length})` },
    { id: 'buyers',    label: `🚢 Buyers (${allBuyers.length})` },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="content-container">
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', borderWidth: '4px' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="content-container">

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Management Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Platform overview, seller approvals, and user records.</p>
        </div>

        {/* Tabs */}
        <div className="tab-group" style={{ marginBottom: '1.5rem' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              style={activeTab === t.id && t.id === 'pending' && pendingSellers.length > 0 ? { color: '#eab308' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { icon: '🏭', label: 'Total Sellers',    value: stats.totalSellers    ?? 0 },
                { icon: '⏳', label: 'Pending',          value: stats.pendingSellers  ?? 0, warn: true },
                { icon: '✅', label: 'Approved',         value: stats.approvedSellers ?? 0, good: true },
                { icon: '❌', label: 'Rejected',         value: stats.rejectedSellers ?? 0, bad: true },
                { icon: '🚢', label: 'Total Buyers',     value: stats.totalBuyers     ?? 0 },
                { icon: '✉️', label: 'Total Inquiries',  value: stats.totalInquiries  ?? 0 },
              ].map(card => (
                <div key={card.label} className="glass-card" style={{ padding: '1.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{card.icon}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: card.good ? '#22c55e' : card.bad ? '#ef4444' : card.warn ? '#eab308' : 'var(--text-primary)' }}>{card.value}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{card.label}</div>
                </div>
              ))}
            </div>
            {pendingSellers.length > 0 && (
              <div className="glass-card" style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #eab308' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{pendingSellers.length} seller{pendingSellers.length > 1 ? 's' : ''} waiting for approval.</strong>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>Go to the Pending tab to review.</span>
                </div>
                <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setActiveTab('pending')}>Review Now</button>
              </div>
            )}
          </div>
        )}

        {/* ── PENDING TAB ── */}
        {activeTab === 'pending' && (
          <div className="glass-card">
            {pendingSellers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>✓</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>All Caught Up</h3>
                <p style={{ color: 'var(--text-secondary)' }}>No pending seller registrations to review right now.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      {['Company', 'Contact Person', 'Email', 'Phone', 'Location', 'Registered On', 'Actions'].map(h => (
                        <th key={h} style={{ ...th, textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSellers.map(s => (
                      <tr key={s.id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.company_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{s.username}</div>
                        </td>
                        <td style={td}>{s.contact_person}</td>
                        <td style={td}>{s.email}</td>
                        <td style={td}>{s.phone}</td>
                        <td style={td}>{[s.city, s.country].filter(Boolean).join(', ') || 'N/A'}</td>
                        <td style={td}>{fmt(s.created_at)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ marginRight: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleReject(s.id)} disabled={actionLoading === s.id}>Reject</button>
                          <button className="btn btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => handleApprove(s.id)} disabled={actionLoading === s.id}>
                            {actionLoading === s.id ? 'Processing…' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ALL SELLERS TAB ── */}
        {activeTab === 'sellers' && (
          <div className="glass-card" style={{ overflowX: 'auto' }}>
            {allSellers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: 'var(--text-secondary)' }}>No sellers registered yet.</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    {['Company', 'Contact', 'Email', 'Phone', 'Location', 'Type', 'Payment', 'Status', 'Registered On'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allSellers.map(s => (
                    <tr key={s.id} style={{ transition: 'background 0.15s' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.company_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{s.username}</div>
                      </td>
                      <td style={td}>{s.contact_person}</td>
                      <td style={td}>{s.email}</td>
                      <td style={td}>{s.phone}</td>
                      <td style={td}>{[s.city, s.country].filter(Boolean).join(', ') || 'N/A'}</td>
                      <td style={td}>{s.description || 'N/A'}</td>
                      <td style={td}>{s.payment_mode || 'N/A'}</td>
                      <td style={td}><span style={statusStyle(s.status)}>{s.status}</span></td>
                      <td style={td}>{fmt(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── ALL BUYERS TAB ── */}
        {activeTab === 'buyers' && (
          <div className="glass-card" style={{ overflowX: 'auto' }}>
            {allBuyers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><p style={{ color: 'var(--text-secondary)' }}>No buyers registered yet.</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr>
                    {['Username', 'Ship Name', 'Ship Type', 'IMO Number', 'Email', 'Phone', 'Country', 'Registered On'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allBuyers.map(b => (
                    <tr key={b.id}>
                      <td style={td}><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{b.username}</span></td>
                      <td style={td}>{b.ship_name}</td>
                      <td style={td}>{b.ship_type}</td>
                      <td style={td}>{b.imo_number}</td>
                      <td style={td}>{b.email}</td>
                      <td style={td}>{b.phone}</td>
                      <td style={td}>{b.country ? `🌍 ${b.country}` : 'N/A'}</td>
                      <td style={td}>{fmt(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}


