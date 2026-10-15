import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';

const API = '/api';

export default function ManagementDashboard() {
  const { token, user } = useAuth();
  const [pendingSellers, setPendingSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchPendingSellers();
  }, []);

  const fetchPendingSellers = async () => {
    try {
      const res = await axios.get(`${API}/management/pending-sellers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingSellers(res.data);
    } catch (error) {
      console.error('Failed to fetch pending sellers:', error);
      toast.error('Failed to load pending sellers.');
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
      <div className="page-container">
        <Navbar />
        <div className="content-container">
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', borderWidth: '4px' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading pending sellers...</p>
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
          <p style={{ color: 'var(--text-secondary)' }}>Approve or reject new seller registrations.</p>
        </div>
      </div>

      <div className="glass-card">
        {pendingSellers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>✓</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>All Caught Up</h3>
            <p style={{ color: 'var(--text-secondary)' }}>There are no pending seller registrations to review.</p>
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
                {pendingSellers.map((seller) => (
                  <tr key={seller.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{seller.company_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{seller.username}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{seller.contact_person}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{seller.email}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{seller.phone}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {seller.city ? `${seller.city}, ` : ''}{seller.country || 'N/A'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
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
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
