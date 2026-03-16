import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = 'http://localhost:5000/api';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/provider/products`);
      setProducts(res.data.products || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(products.map((p) => p.category))];

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = !selectedCategory || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

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
        {/* Header */}
        <div className="dashboard-header">
          <h1>Welcome, {user?.username} 👋</h1>
          <p>Browse marine spare parts from verified providers</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-value">{products.length}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏭</div>
            <div className="stat-value">{new Set(products.map((p) => p.company_name)).size}</div>
            <div className="stat-label">Providers</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📂</div>
            <div className="stat-value">{categories.length}</div>
            <div className="stat-label">Categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚓</div>
            <div className="stat-value">24/7</div>
            <div className="stat-label">Support</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: '250px' }}
            type="text"
            placeholder="🔍 Search products, parts, or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="form-select"
            style={{ minWidth: '200px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌊</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              {products.length === 0
                ? 'No products listed yet. Check back soon!'
                : 'No products match your search.'}
            </p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((product) => (
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
                <p className="product-company">🏢 {product.company_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
