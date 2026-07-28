import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';

const API = '/api';

export default function ManagementDashboard() {
  const { token, user } = useAuth();
  const [pendingProviders, setPendingProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchPendingProviders();
  }, []);

  const fetchPendingProviders = async () => {
    try {
      const res = await axios.get(`${API}/management/pending-providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingProviders(res.data);
    } catch (error) {
      console.error('Failed to fetch pending providers:', error);
      toast.error('Failed to load pending vendors.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (providerId) => {
    setActionLoading(providerId);
    try {
      await axios.put(`${API}/management/providers/${providerId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Provider approved successfully.');
      setPendingProviders(pendingProviders.filter(p => p.id !== providerId));
    } catch (error) {
      console.error('Failed to approve provider:', error);
      toast.error('Failed to approve vendor.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (providerId) => {
    if (!window.confirm('Are you sure you want to reject this vendor application?')) return;
    
    setActionLoading(providerId);
    try {
      await axios.put(`${API}/management/providers/${providerId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Provider rejected.');
      setPendingProviders(pendingProviders.filter(p => p.id !== providerId));
    } catch (error) {
      console.error('Failed to reject provider:', error);
      toast.error('Failed to reject vendor.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="content-container">
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', borderWidth: '4px' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading pending vendors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="content-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Management Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Approve or reject new vendor registrations.</p>
        </div>
      </div>

      <div className="glass-card">
        {pendingProviders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>✓</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>All Caught Up</h3>
            <p style={{ color: 'var(--text-secondary)' }}>There are no pending vendor registrations to review.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Company Name</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Person</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Phone</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Location</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingProviders.map((provider) => (
                  <tr key={provider.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{provider.company_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{provider.username}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{provider.contact_person}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{provider.email}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{provider.phone}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {provider.city ? `${provider.city}, ` : ''}{provider.country || 'N/A'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ marginRight: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        onClick={() => handleReject(provider.id)}
                        disabled={actionLoading === provider.id}
                      >
                        Reject
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                        onClick={() => handleApprove(provider.id)}
                        disabled={actionLoading === provider.id}
                      >
                        {actionLoading === provider.id ? 'Processing...' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
