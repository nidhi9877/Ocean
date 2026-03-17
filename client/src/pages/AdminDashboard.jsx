import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

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
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
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
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
        <button 
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          Basic Users
        </button>
        <button 
          className={`btn ${activeTab === 'providers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('providers')}
        >
          Vendors (Providers)
        </button>
        <button 
          className={`btn ${activeTab === 'buyers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('buyers')}
        >
          Buyers
        </button>
      </div>

      {/* Content Area */}
      <div className="glass-card" style={{ padding: '2rem', overflowX: 'auto' }}>
        {activeTab === 'users' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif" }}>User Registry</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--teal-accent)' }}>
                  <th style={{ padding: '1rem' }}>ID</th>
                  <th style={{ padding: '1rem' }}>Username</th>
                  <th style={{ padding: '1rem' }}>Role</th>
                  <th style={{ padding: '1rem' }}>Registered On</th>
                  <th style={{ padding: '1rem' }}>Security</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>#{user.id}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{user.username}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`nav-user-badge ${user.role === 'provider' ? 'badge-provider' : 'badge-buyer'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#00d4aa', background: 'rgba(0,212,170,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        🔒 Bcrypt Hashed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>No users found.</p>}
          </div>
        )}

        {activeTab === 'providers' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif" }}>Vendor Profiles</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--teal-accent)' }}>
                  <th style={{ padding: '1rem' }}>Company</th>
                  <th style={{ padding: '1rem' }}>Type / Desc</th>
                  <th style={{ padding: '1rem' }}>Email / Phone</th>
                  <th style={{ padding: '1rem' }}>Address</th>
                  <th style={{ padding: '1rem' }}>Username</th>
                </tr>
              </thead>
              <tbody>
                {providers.map(provider => (
                  <tr key={provider.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{provider.company_name}</td>
                    <td style={{ padding: '1rem' }}>{provider.description || 'N/A'}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      <div>✉️ {provider.email}</div>
                      <div>📞 {provider.phone}</div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      {provider.address || 'N/A'} {provider.city ? `, ${provider.city}` : ''} {provider.country ? `, ${provider.country}` : ''}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{provider.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {providers.length === 0 && <p style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>No vendors registered yet.</p>}
          </div>
        )}

        {activeTab === 'buyers' && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif" }}>Buyer Profiles</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--teal-accent)' }}>
                  <th style={{ padding: '1rem' }}>Ship Name</th>
                  <th style={{ padding: '1rem' }}>IMO Number</th>
                  <th style={{ padding: '1rem' }}>Ship Type</th>
                  <th style={{ padding: '1rem' }}>Email / Phone</th>
                  <th style={{ padding: '1rem' }}>Username</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map(buyer => (
                  <tr key={buyer.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{buyer.ship_name}</td>
                    <td style={{ padding: '1rem' }}>{buyer.imo_number}</td>
                    <td style={{ padding: '1rem' }}>{buyer.ship_type}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      <div>✉️ {buyer.email}</div>
                      <div>📞 {buyer.phone}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{buyer.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {buyers.length === 0 && <p style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>No buyers registered yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
