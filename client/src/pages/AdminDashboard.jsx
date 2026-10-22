import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API = '/api';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalProviders: 0, totalProducts: 0, totalInquiries: 0 });
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [pendingSellers, setPendingSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [statsRes, usersRes, providersRes, buyersRes, inquiriesRes, pendingRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/providers`),
        axios.get(`${API}/admin/buyers`),
        axios.get(`${API}/admin/inquiries`),
        axios.get(`${API}/management/pending-sellers`, authHeaders),
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setProviders(providersRes.data);
      setBuyers(buyersRes.data);
      setInquiries(inquiriesRes.data);
      setPendingSellers(pendingRes.data);
    } catch (err) {
      setError('Failed to fetch admin data. Make sure backend is connected.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sellerId) => {
    setActionLoading(sellerId);
    try {
      await axios.put(`${API}/management/sellers/${sellerId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Seller approved successfully.');
      setPendingSellers(pendingSellers.filter(p => p.id !== sellerId));
    } catch (error) {
      console.error('Failed to approve seller:', error);
      toast.error('Failed to approve seller.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (sellerId) => {
    if (!window.confirm('Are you sure you want to reject this seller application?')) return;
    setActionLoading(sellerId);
    try {
      await axios.put(`${API}/management/sellers/${sellerId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Seller rejected.');
      setPendingSellers(pendingSellers.filter(p => p.id !== sellerId));
    } catch (error) {
      console.error('Failed to reject seller:', error);
      toast.error('Failed to reject seller.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ paddingTop: '2rem' }}>
      <div className="dashboard-header" style={{ textAlign: 'center' }}>
        <h1>Admin Control Panel</h1>
        <p>Platform Analytics & User Management</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '2rem' }}>{error}</div>}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏭</div>
          <div className="stat-value">{stats.totalSellers ?? stats.totalProviders}</div>
          <div className="stat-label">Registered Sellers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚙️</div>
          <div className="stat-value">{stats.totalProducts}</div>
          <div className="stat-label">Parts Listed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✉️</div>
          <div className="stat-value">{stats.totalInquiries}</div>
          <div className="stat-label">Total Inquiries</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
          style={{ position: 'relative' }}
        >
          Pending Approvals
          {pendingSellers.length > 0 && (
            <span style={{ marginLeft: '0.4rem', background: 'var(--danger, #ef4444)', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '0.1rem 0.45rem', fontWeight: 700, verticalAlign: 'middle' }}>
              {pendingSellers.length}
            </span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'providers' ? 'active' : ''}`}
          onClick={() => setActiveTab('providers')}
        >
          Sellers
        </button>
        <button 
          className={`tab-btn ${activeTab === 'buyers' ? 'active' : ''}`}
          onClick={() => setActiveTab('buyers')}
        >
          Buyers
        </button>
        <button 
          className={`tab-btn ${activeTab === 'inquiries' ? 'active' : ''}`}
          onClick={() => setActiveTab('inquiries')}
        >
          Inquiries
        </button>
      </div>

      {/* Content Area */}
      <div className="glass-card" style={{ padding: '2rem', overflowX: 'auto' }}>
        {activeTab === 'pending' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pending Seller Approvals</h2>
            {pendingSellers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>✓</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>All Caught Up</h3>
                <p style={{ color: 'var(--text-secondary)' }}>There are no pending seller registrations to review.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSellers.map((seller) => (
                    <tr key={seller.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{seller.company_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{seller.username}</div>
                      </td>
                      <td>{seller.contact_person}</td>
                      <td>{seller.email}</td>
                      <td>{seller.phone}</td>
                      <td>{seller.city ? `${seller.city}, ` : ''}{seller.country || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ marginRight: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          onClick={() => handleReject(seller.id)}
                          disabled={actionLoading === seller.id}
                        >
                          Reject
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => handleApprove(seller.id)}
                          disabled={actionLoading === seller.id}
                        >
                          {actionLoading === seller.id ? 'Processing...' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>User Registry</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Registered On</th>
                  <th>Security</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>#{user.id}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{user.username}</td>
                    <td>
                      <span className={`nav-user-badge ${user.role === 'provider' || user.role === 'seller' ? 'badge-seller' : 'badge-buyer'}`}>
                        {user.role === 'provider' ? 'seller' : user.role}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--success-border)' }}>
                        🔒 Bcrypt
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div className="empty-state"><p>No users found.</p></div>}
          </div>
        )}

        {activeTab === 'providers' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Seller Profiles</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type / Desc</th>
                  <th>Email / Phone</th>
                  <th>Address</th>
                  <th>Payment Mode</th>
                  <th>Username</th>
                </tr>
              </thead>
              <tbody>
                {providers.map(provider => (
                  <tr key={provider.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{provider.company_name}</td>
                    <td>{provider.description || 'N/A'}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>✉️ {provider.email}</div>
                      <div>📞 {provider.phone}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {provider.address || 'N/A'} {provider.city ? `, ${provider.city}` : ''} {provider.country ? `, ${provider.country}` : ''}
                    </td>
                    <td>{provider.payment_mode || 'N/A'}</td>
                    <td>{provider.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {providers.length === 0 && <div className="empty-state"><p>No sellers registered yet.</p></div>}
          </div>
        )}

        {activeTab === 'buyers' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Buyer Profiles</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ship Name</th>
                  <th>IMO Number</th>
                  <th>Ship Type</th>
                  <th>Country</th>
                  <th>Email / Phone</th>
                  <th>Username</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map(buyer => (
                  <tr key={buyer.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{buyer.ship_name}</td>
                    <td>{buyer.imo_number}</td>
                    <td>{buyer.ship_type}</td>
                    <td>{buyer.country ? `🌍 ${buyer.country}` : 'N/A'}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div>✉️ {buyer.email}</div>
                      <div>📞 {buyer.phone}</div>
                    </td>
                    <td>{buyer.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {buyers.length === 0 && <div className="empty-state"><p>No buyers registered yet.</p></div>}
          </div>
        )}

        {activeTab === 'inquiries' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Inquiries Directory</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product Details</th>
                  <th>Buyer (Ship)</th>
                  <th>Seller</th>
                  <th>Delivery Reqs</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map(inquiry => (
                  <tr key={inquiry.id}>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(inquiry.created_at).toLocaleDateString()}<br/>{new Date(inquiry.created_at).toLocaleTimeString()}</td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{inquiry.product_name || inquiry.category || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Part #: {inquiry.part_number || 'N/A'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{inquiry.buyer_username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inquiry.buyer_email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ship: {inquiry.ship_name || 'N/A'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{inquiry.vendor_company || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{inquiry.vendor_username}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div><strong>Dest:</strong> {inquiry.destination_location}</div>
                      <div><strong>ETA:</strong> {inquiry.delivery_requirements?.eta || 'N/A'}</div>
                    </td>
                    <td>
                      <span className={`nav-user-badge ${inquiry.status === 'pending' ? 'badge-buyer' : inquiry.status === 'accepted' ? 'badge-seller' : ''}`} style={{ background: inquiry.status === 'rejected' ? 'var(--danger-bg)' : undefined, color: inquiry.status === 'rejected' ? 'var(--danger)' : undefined, borderColor: inquiry.status === 'rejected' ? 'var(--danger-border)' : undefined }}>
                        {inquiry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inquiries.length === 0 && <div className="empty-state"><p>No inquiries made yet.</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
