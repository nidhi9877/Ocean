import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

export default function ProviderDashboard() {
  const { user, token } = useAuth();
  const [provider, setProvider] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/provider/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProvider(res.data.provider);
      setProducts(res.data.products || []);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
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
            <h1>Provider Dashboard 🏭</h1>
            <p>Manage your company profile and product listings</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/provider/add-options')}
            >
              + Add New Parts
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/provider/inquiries')}
            >
              📨 View Inquiries
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
          </div>
        ) : !provider ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">📋</span>
            <h3>No provider profile found</h3>
            <p>Please complete your registration to get started.</p>
          </div>
        ) : (
          <>
            {/* Company Info Card */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.6s ease-out' }}>
              <div className="form-section-title">
                <span className="form-section-icon">🏢</span>
                {provider.company_name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>👤 {provider.contact_person}</p>
                <p>📧 {provider.email}</p>
                <p>📞 {provider.phone}</p>
                <p>📍 {provider.address}{provider.city ? `, ${provider.city}` : ''}{provider.country ? `, ${provider.country}` : ''}</p>
              </div>
              {provider.description && (
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {provider.description}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-value">{products.length}</div>
                <div className="stat-label">Listed Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📂</div>
                <div className="stat-value">{new Set(products.map((p) => p.category)).size}</div>
                <div className="stat-label">Categories</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{products.reduce((sum, p) => sum + (p.quantity || 0), 0)}</div>
                <div className="stat-label">Total Stock</div>
              </div>
            </div>

            {/* Products */}
            <div style={{ marginTop: '0.5rem' }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Your Products
              </h2>
              {products.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No products listed yet.</p>
              ) : (
                <div className="products-grid">
                  {products.map((product) => (
                    <div key={product.id} className="product-list-card">
                      <h3>{product.product_name}</h3>
                      <span className="product-category">{product.category}</span>
                      {product.part_number && (
                        <p className="product-info">Part #: {product.part_number}</p>
                      )}
                      {product.quantity > 0 && (
                        <p className="product-info">In Stock: {product.quantity} units</p>
                      )}
                      {product.description && (
                        <p className="product-info">{product.description}</p>
                      )}
                      {product.location && (
                        <p className="product-info" style={{ color: 'var(--accent-secondary)', marginTop: '0.2rem' }}>
                          📍 Ships to: {product.location}
                        </p>
                      )}
                      {product.additional_info && (
                        <p className="product-info" style={{ fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.8 }}>
                          ℹ️ {product.additional_info}
                        </p>
                      )}
                      <div className="product-price">{Number(product.price).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
