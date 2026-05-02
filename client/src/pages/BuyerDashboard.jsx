import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [formData, setFormData] = useState({
    equipment: '',
    manufacturer: '',
    modelNumber: '',
    yearOfManufacturer: '',
    partName: '',
    partNumer: '',
    stockLocation: '',
    qunatity: '',
    eta: '',
    etd: '',
    destination: '',
    vesselName: ''
  });

  // Track which product IDs are currently sending (for per-row loading state)
  const [sendingIds, setSendingIds] = useState(new Set());

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    
    // Check mandatory fields
    const required = ['equipment', 'manufacturer', 'modelNumber', 'yearOfManufacturer', 'partName', 'partNumer', 'stockLocation', 'qunatity', 'eta', 'etd', 'destination'];
    for (let field of required) {
      if (!formData[field]) {
        toast.error(`Please fill out the mandatory field: ${field}`);
        return;
      }
    }

    const searchQty = Number(formData.qunatity);

    const matches = (dbValue, formValue) => {
      if (!dbValue) return false;
      return String(dbValue).toLowerCase().includes(String(formValue).trim().toLowerCase());
    };

    const results = allProducts.filter(p => {
      const matchEquipment = matches(p.category, formData.equipment);
      const matchManufacturer = matches(p.brand, formData.manufacturer);
      const matchModel = matches(p.model_number, formData.modelNumber);
      const matchYear = matches(p.manufactured_at, formData.yearOfManufacturer);
      const matchPartName = matches(p.product_name, formData.partName);
      const matchPartNumer = matches(p.part_number, formData.partNumer);
      const matchLocation = matches(p.location, formData.stockLocation);
      const matchQty = Number(p.quantity) >= searchQty;

      return matchEquipment && matchManufacturer && matchModel && matchYear && matchPartName && matchPartNumer && matchLocation && matchQty;
    });

    setProducts(results);
    setHasSearched(true);
    
    if (results.length === 0) {
      toast.error('No products found matching exactly with these details.');
    } else {
      toast.success(`Found ${results.length} matching products.`);
    }
  };

  const displayedProducts = hasSearched ? products : [];

  // ─── Send Inquiry via Backend API ────────────────────────────────────────────
  // Replaces the old Gmail mailto link. Posts to the backend which:
  //   1. Inserts an inquiry record into the DB (for tracking)
  //   2. Sends a professional HTML email to the vendor via Resend
  //   3. Sets Reply-To to the buyer's email so vendors reply directly
  const handleSendInquiry = async (product) => {
    // Validate destination
    if (!formData.destination.trim()) {
      toast.error('Please enter a delivery destination before sending an inquiry.');
      return;
    }

    // Prevent duplicate sends
    if (sendingIds.has(product.id)) return;

    // Mark this product as "sending"
    setSendingIds(prev => new Set(prev).add(product.id));

    try {
      const res = await axios.post(`${API}/buyer/inquiries`, {
        selections: [{ provider_id: product.provider_id, product_id: product.id }],
        destination_location: formData.destination.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(
        `✅ Inquiry sent to ${product.company_name}! They'll receive a professional email with your details.`,
        { duration: 4000 }
      );
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send inquiry. Please try again.';
      toast.error(errorMsg);
      console.error('Inquiry send error:', err);
    } finally {
      // Remove from sending state
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

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

        {/* Search & Filter Form */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Outfit', sans-serif", fontSize: '1.4rem' }}>Find Parts & Request Details</h2>
          <form onSubmit={handleSearch}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="form-label">Equipment *</label>
                <input type="text" className="form-input" name="equipment" value={formData.equipment} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Manufacturer *</label>
                <input type="text" className="form-input" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Model number *</label>
                <input type="text" className="form-input" name="modelNumber" value={formData.modelNumber} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Year of manufacturer *</label>
                <input type="text" className="form-input" name="yearOfManufacturer" value={formData.yearOfManufacturer} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Part Name *</label>
                <input type="text" className="form-input" name="partName" value={formData.partName} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Part Numer *</label>
                <input type="text" className="form-input" name="partNumer" value={formData.partNumer} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Stock location *</label>
                <input type="text" className="form-input" name="stockLocation" value={formData.stockLocation} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Qunatity *</label>
                <input type="number" className="form-input" name="qunatity" value={formData.qunatity} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">ETA *</label>
                <input type="date" className="form-input" name="eta" value={formData.eta} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">ETD *</label>
                <input type="date" className="form-input" name="etd" value={formData.etd} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Destination *</label>
                <input type="text" className="form-input" name="destination" value={formData.destination} onChange={handleChange} required />
              </div>
              <div>
                <label className="form-label">Vessel Name (Optional)</label>
                <input type="text" className="form-input" name="vesselName" value={formData.vesselName} onChange={handleChange} />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>🔍 Search Database</button>
            </div>
          </form>
        </div>

        {/* Search Results */}
        {!hasSearched ? (
          <div className="glass-card empty-state">
            <span className="empty-state-icon">🔍</span>
            <p style={{ color: 'var(--text-secondary)' }}>Fill out the required details above to search for a match.</p>
          </div>
        ) : displayedProducts.length === 0 ? (
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
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Equipment</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Manufacturer</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Model number</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Year of manufacturer</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Part Name</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Part Numer</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Stock location</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Quantity</th>
                  <th style={{ padding: '0.75rem', fontWeight: 'bold' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedProducts.map(product => {
                  const isSending = sendingIds.has(product.id);
                  return (
                  <tr key={product.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '0.75rem' }}>{product.category || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.brand || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.model_number || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.manufactured_at || '-'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '500', color: 'var(--text-primary)' }}>{product.product_name || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{product.part_number || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{product.location || '-'}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{product.quantity || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>
                        <button
                          className="btn btn-primary"
                          style={{ 
                            padding: '0.4rem 0.8rem', 
                            fontSize: '0.85rem', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '0.4rem',
                            minWidth: '140px',
                            opacity: isSending ? 0.7 : 1,
                            cursor: isSending ? 'not-allowed' : 'pointer',
                          }}
                          onClick={() => handleSendInquiry(product)}
                          disabled={isSending}
                        >
                          {isSending ? (
                            <>
                              <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
                              Sending...
                            </>
                          ) : (
                            <>✉️ Send Inquiry</>
                          )}
                        </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
