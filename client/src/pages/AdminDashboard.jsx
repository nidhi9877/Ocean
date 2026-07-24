import { useState, useEffect } from 'react';
import axios from 'axios';

const API = '/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalProviders: 0, totalProducts: 0 });
  const [users, setUsers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, providersRes, buyersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/providers`),
        axios.get(`${API}/admin/buyers`)
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setProviders(providersRes.data);
      setBuyers(buyersRes.data);
    } catch (err) {
      setError('Failed to fetch admin data. Make sure backend is connected.');
      console.error(err);
    } finally {
      setLoading(false);
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
          <div className="stat-value">{stats.totalProviders}</div>
          <div className="stat-label">Registered Providers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚙️</div>
          <div className="stat-value">{stats.totalProducts}</div>
          <div className="stat-label">Parts Listed</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group">
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
          Vendors
        </button>
        <button 
          className={`tab-btn ${activeTab === 'buyers' ? 'active' : ''}`}
          onClick={() => setActiveTab('buyers')}
        >
          Buyers
        </button>
      </div>

      {/* Content Area */}
      <div className="glass-card" style={{ padding: '2rem', overflowX: 'auto' }}>
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
                      <span className={`nav-user-badge ${user.role === 'provider' ? 'badge-provider' : 'badge-buyer'}`}>
                        {user.role}
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
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vendor Profiles</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type / Desc</th>
                  <th>Email / Phone</th>
                  <th>Address</th>
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
                    <td>{provider.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {providers.length === 0 && <div className="empty-state"><p>No vendors registered yet.</p></div>}
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
      </div>
    </div>
  );
}
