import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SmartSearchBar from '../components/SmartSearchBar';

const API = '/api';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');


  // Fetch all products once for categories
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await axios.get(`${API}/provider/products`);
        setAllProducts(res.data.products || []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };
    fetchAllProducts();
  }, []);

  const categories = [...new Set(allProducts.map((p) => p.category))];

  // Handle search results from SmartSearchBar
  const handleSearchResults = useCallback((results, searched) => {
    setProducts(results);
    setHasSearched(searched);
  }, []);


  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Welcome, {user?.username} 👋</h1>
            <p>Search marine spare parts and send mass inquiries directly to vendors.</p>
          </div>
          <a href="/buyer/inquiries" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📨</span> My Inquiries Inbox
          </a>
        </div>

        {/* Smart Search & Filter */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <SmartSearchBar
                onSearchResults={handleSearchResults}
                selectedCategory={selectedCategory}
              />
            </div>
            <select
              className="form-select" style={{ minWidth: '200px', alignSelf: 'flex-start', marginTop: '2px' }}
              value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Results */}
        {!hasSearched ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">🚢</span>
            <h3>Start by searching for a product</h3>
            <p>Discover verified vendors for the equipment you need.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              💡 Tip: Typos are OK! Search "scroo" and we'll find "screw" for you.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">🌊</span>
            <p style={{ color: 'var(--text-secondary)' }}>No vendors found matching this product.</p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Found <strong style={{ color: 'var(--accent-primary)' }}>{products.length}</strong> result{products.length !== 1 ? 's' : ''}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Product Name</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Category</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Brand</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Part #</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Price (₹)</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Vendor</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Contact</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '500', color: 'var(--text-primary)' }}>{product.product_name}</td>
                    <td style={{ padding: '0.75rem' }}>{product.category}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.brand || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.part_number || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Number(product.price).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem' }}>{product.company_name}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.contact_person || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {product.provider_email ? (
                        <a 
                          href={`mailto:${product.provider_email}?subject=${encodeURIComponent("Inquiry for " + product.product_name)}&body=${encodeURIComponent("Hello,\n\nI am interested in your product: " + product.product_name + "\nPart Number: " + (product.part_number || "N/A") + "\nBrand: " + (product.brand || "N/A") + "\n\nPlease provide more details.")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="to communicate send the mail"
                          onClick={() => toast('Check the message before sending it once', { icon: '⚠️', duration: 4000 })}
                          style={{ color: 'var(--accent-primary)', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          📧 Email <span style={{ textDecoration: 'underline' }}>{product.provider_email}</span>
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
