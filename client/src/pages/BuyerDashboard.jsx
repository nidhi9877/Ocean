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
  const [destination, setDestination] = useState('');


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

  const displayedProducts = hasSearched 
    ? products 
    : (selectedCategory ? allProducts.filter(p => p.category === selectedCategory) : allProducts);

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
          
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>📍 Required Delivery Destination:</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter destination (e.g., Port of Singapore)" 
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              style={{ flex: 1, minWidth: '250px', maxWidth: '400px' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>This will be automatically included in your email inquiries.</span>
          </div>
        </div>

        {/* Search Results */}
        {displayedProducts.length === 0 ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">🌊</span>
            <p style={{ color: 'var(--text-secondary)' }}>No vendors found matching this criteria.</p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Found <strong style={{ color: 'var(--accent-primary)' }}>{displayedProducts.length}</strong> result{displayedProducts.length !== 1 ? 's' : ''}
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
                {displayedProducts.map(product => (
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <a 
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${product.provider_email}&su=${encodeURIComponent("Inquiry for " + product.product_name)}&body=${encodeURIComponent(`Hello ${product.company_name} Team,\n\nI am interested in your product and would like more details.\n\n--- PRODUCT DETAILS ---\nProduct Name: ${product.product_name}\nCategory: ${product.category}\nBrand: ${product.brand || "N/A"}\nPart Number: ${product.part_number || "N/A"}\nPrice Listed: ₹${Number(product.price).toLocaleString()}\n\n--- MY REQUIREMENTS ---\nDelivery Destination: ${destination ? destination : "[Please specify destination]"}\n\nPlease provide availability, shipping costs, and any additional details required.\n\nBest regards,\nMarine Market Buyer`)}`}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', textDecoration: 'none' }}
                          >
                            ✉️ Send via Gmail
                          </a>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.provider_email}</span>
                        </div>
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
