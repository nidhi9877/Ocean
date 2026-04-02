import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  
  // Inquiry State
  const [selectionType, setSelectionType] = useState('all'); // 'all' or 'manual'
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [destinationLocation, setDestinationLocation] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState({ type: '', msg: '' });

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

  const handleCheckbox = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSendInquiry = async (e) => {
    e.preventDefault();
    setInquiryStatus({ type: '', msg: '' });
    
    let selections = [];
    if (selectionType === 'all') {
      selections = products.map(p => ({ provider_id: p.provider_id, product_id: p.id }));
    } else {
      selections = products
        .filter(p => selectedProducts.has(p.id))
        .map(p => ({ provider_id: p.provider_id, product_id: p.id }));
    }

    if (selections.length === 0) {
      setInquiryStatus({ type: 'error', msg: 'No companies selected for inquiry.' });
      return;
    }

    if (!destinationLocation) {
      setInquiryStatus({ type: 'error', msg: 'Please enter your destination location.' });
      return;
    }

    setSendingInquiry(true);
    try {
      await axios.post(
        `${API}/buyer/inquiries`,
        { selections, destination_location: destinationLocation },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInquiryStatus({ type: 'success', msg: `Message sent to ${selections.length} vendor(s) successfully!` });
      // Reset form
      setDestinationLocation('');
      setSelectedProducts(new Set());
    } catch (err) {
      setInquiryStatus({ type: 'error', msg: err.response?.data?.error || 'Failed to send inquiry.' });
    } finally {
      setSendingInquiry(false);
    }
  };

  return (
    <>
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
        </div>
      </div>

      <Navbar />

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header text-center" style={{ textAlign: 'center', position: 'relative' }}>
          <h1>Welcome, {user?.username} 👋</h1>
          <p>Search marine spare parts and send mass inquiries directly to vendors.</p>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <a href="/buyer/inquiries" className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📨</span> My Inquiries Inbox
            </a>
          </div>
        </div>

        {/* Smart Search & Filter */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
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
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.8 }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚢</p>
            <h3>Start by searching for a product</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Discover verified vendors for the equipment you need.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              💡 Tip: Typos are OK! Search "scroo" and we'll find "screw" for you.
            </p>
          </div>
        ) : products.length === 0 ? (
           <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌊</p>
            <p style={{ color: 'var(--text-secondary)' }}>No vendors found selling matching this product.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
            
            {/* Left Col: Results Grid */}
<<<<<<< Updated upstream
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Found <strong style={{ color: 'var(--teal-accent)' }}>{products.length}</strong> result{products.length !== 1 ? 's' : ''} ranked by relevance
              </p>
              <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {products.map((product) => (
                  <div key={product.id} className="product-list-card" style={{ position: 'relative' }}>
                     {selectionType === 'manual' && (
                      <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
                        <input 
                          type="checkbox" 
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          checked={selectedProducts.has(product.id)}
                          onChange={() => handleCheckbox(product.id)}
                        />
                      </div>
                    )}
                    <div style={{ paddingRight: selectionType === 'manual' ? '30px' : '0' }}>
                      <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{product.product_name}</h3>
                      <span className="product-category" style={{ marginBottom: '1rem' }}>{product.category}</span>
                      <p className="product-company" style={{ fontWeight: 'bold' }}>🏢 Vendor: {product.company_name}</p>
                      
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {product.brand && <p>Brand: {product.brand}</p>}
                        {product.part_number && <p>Part #: {product.part_number}</p>}
                        {product.location && <p>Location: {product.location}</p>}
                      </div>

                      <div className="product-price" style={{ marginTop: '1rem' }}>₹{Number(product.price).toLocaleString()}</div>
                    </div>
=======
            <div className="products-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {filteredProducts.map((product) => (
                <div key={product.id} className="product-list-card" style={{ position: 'relative' }}>
                   {selectionType === 'manual' && (
                    <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleCheckbox(product.id)}
                      />
                    </div>
                  )}
                  <div style={{ paddingRight: selectionType === 'manual' ? '30px' : '0' }}>
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{product.product_name}</h3>
                    <span className="product-category" style={{ marginBottom: '1rem' }}>{product.category}</span>
                    <p className="product-company" style={{ fontWeight: 'bold' }}>🏢 Vendor: {product.company_name}</p>
                    
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {product.brand && <p>Brand: {product.brand}</p>}
                      {product.part_number && <p>Part #: {product.part_number}</p>}
                      {product.location && <p style={{ color: 'var(--teal-accent)' }}>📍 Ships To: {product.location}</p>}
                      {product.additional_info && <p style={{ fontStyle: 'italic', opacity: 0.8 }}>ℹ️ Info: {product.additional_info}</p>}
                    </div>

                    <div className="product-price" style={{ marginTop: '1rem' }}>{Number(product.price).toLocaleString()}</div>
>>>>>>> Stashed changes
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Inquiry Box */}
            <div className="glass-card" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.5rem', marginBottom: '1rem' }}>
                📨 Send Inquiry
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Contact the vendors of the products listed in your search results.
              </p>

              <form onSubmit={handleSendInquiry}>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 'bold' }}>Select Vendors:</label>
                  <label style={{ display: 'block', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" name="selectionType" value="all" 
                      checked={selectionType === 'all'} onChange={() => setSelectionType('all')}
                      style={{ marginRight: '0.5rem' }}
                    />
                     Send to All {products.length} Vendor(s)
                  </label>
                  <label style={{ display: 'block', cursor: 'pointer' }}>
                    <input 
                      type="radio" name="selectionType" value="manual" 
                      checked={selectionType === 'manual'} onChange={() => setSelectionType('manual')}
                      style={{ marginRight: '0.5rem' }}
                    />
                     Select Manually
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold' }}>Destination Location *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Port of Singapore"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                  />
                </div>

                {inquiryStatus.msg && (
                  <div className={`alert ${inquiryStatus.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem', padding: '0.8rem' }}>
                    {inquiryStatus.msg}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary btn-block" 
                  style={{ fontWeight: 'bold' }}
                  disabled={sendingInquiry}
                >
                  {sendingInquiry ? <span className="spinner"></span> : `Submit Inquiry`}
                </button>

              </form>
            </div>
            
          </div>
        )}
      </div>
    </>
  );
}

