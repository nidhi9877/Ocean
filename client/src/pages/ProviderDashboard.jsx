import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = 'http://localhost:5000/api';

export default function ProviderDashboard() {
  const { user, token } = useAuth();
  const [provider, setProvider] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>

      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Provider Dashboard 🏭</h1>
          <p>Manage your company profile and product listings</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
          </div>
        ) : !provider ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              No provider profile found. Please complete your registration.
            </p>
          </div>
        ) : (
          <>
            {/* Company Info Card */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.6s ease-out' }}>
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
            <div style={{ marginTop: '1rem' }}>
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
                      <div className="product-price">₹{Number(product.price).toLocaleString()}</div>
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
