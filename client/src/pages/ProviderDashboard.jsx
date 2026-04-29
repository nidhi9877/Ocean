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
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
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

  const startEditing = (product) => {
    setEditingId(product.id);
    setEditData({
      product_name: product.product_name || '',
      category: product.category || '',
      part_number: product.part_number || '',
      brand: product.brand || '',
      model_number: product.model_number || '',
      location: product.location || '',
      quantity: product.quantity || 0,
      price: product.price || 0,
      description: product.description || '',
      manufactured_at: product.manufactured_at || '',
      additional_info: product.additional_info || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/provider/products/${editingId}`, editData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Update local state
      setProducts(prev =>
        prev.map(p => p.id === editingId ? { ...p, ...editData } : p)
      );
      setEditingId(null);
      setEditData({});
    } catch (err) {
      console.error('Failed to update product:', err);
      alert(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/provider/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected products?`)) return;
    setDeleting(true);
    try {
      await axios.post(`${API}/provider/products/bulk-delete`, { ids: selectedIds }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete products');
    } finally {
      setDeleting(false);
    }
  };

  const deleteAll = async () => {
    if (products.length === 0) return;
    if (!window.confirm('WARNING: Are you sure you want to delete ALL your products? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/provider/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts([]);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete all products');
    } finally {
      setDeleting(false);
    }
  };

  const editInput = (field, style = {}) => (
    <input
      className="inline-edit-input"
      value={editData[field] || ''}
      onChange={(e) => handleEditChange(field, e.target.value)}
      style={style}
      autoFocus={field === 'product_name'}
    />
  );

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="menu-btn" 
              onClick={() => setIsSidebarOpen(true)}
              title="Show Company Info"
            >
              ☰
            </button>
            <div>
              <h1>Provider Dashboard 🏭</h1>
              <p>Manage your company profile and product listings</p>
            </div>
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
            {/* Sidebar Overlay */}
            {isSidebarOpen && (
              <div 
                className="sidebar-overlay" 
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <div className={`info-sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header">
                <h2>Company Overview</h2>
                <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
              </div>
              
              <div className="sidebar-content">
                {/* Company Info Card */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-section-title">
                    <span className="form-section-icon">🏢</span>
                    {provider.company_name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
                <div className="stats-sidebar-grid">
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
              </div>
            </div>

            {/* Products Table */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', color: 'var(--text-primary)', margin: 0 }}>
                  Your Products
                </h2>
                {products.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                      <button className="btn btn-primary" onClick={bulkDelete} disabled={deleting} style={{ background: '#e74c3c', borderColor: '#e74c3c' }}>
                        🗑️ Delete Selected ({selectedIds.length})
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={deleteAll} disabled={deleting} style={{ color: '#e74c3c', borderColor: '#e74c3c' }}>
                      ⚠️ Delete Entire Sheet
                    </button>
                  </div>
                )}
              </div>
              {products.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No products listed yet.</p>
              ) : (
                <div className="glass-card provider-products-table-wrap" style={{ padding: 0, animation: 'slideUp 0.5s ease-out' }}>
                  <table className="data-table provider-products-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={products.length > 0 && selectedIds.length === products.length}
                            onChange={handleSelectAll}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th>#</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Part #</th>
                        <th>Brand</th>
                        <th>Model</th>
                        <th>Location</th>
                        <th>Stock</th>
                        <th style={{ textAlign: 'right' }}>Price (₹)</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, idx) => (
                        <tr key={product.id} className={editingId === product.id ? 'editing-row' : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(product.id)}
                              onChange={() => handleSelect(product.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{idx + 1}</td>

                          {editingId === product.id ? (
                            <>
                              <td>{editInput('product_name')}</td>
                              <td>{editInput('category')}</td>
                              <td>{editInput('part_number')}</td>
                              <td>{editInput('brand')}</td>
                              <td>{editInput('model_number')}</td>
                              <td>{editInput('location')}</td>
                              <td>{editInput('quantity', { width: '60px', textAlign: 'center' })}</td>
                              <td>{editInput('price', { width: '90px', textAlign: 'right' })}</td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={saveEdit}
                                  disabled={saving}
                                  style={{ marginRight: '0.35rem' }}
                                >
                                  {saving ? '...' : '✓ Save'}
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={cancelEditing}
                                  disabled={saving}
                                >
                                  ✕
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.product_name}</td>
                              <td><span className="product-category">{product.category}</span></td>
                              <td>{product.part_number || '—'}</td>
                              <td>{product.brand || '—'}</td>
                              <td>{product.model_number || '—'}</td>
                              <td><span className="location-cell" title={product.location || ''}>{product.location || '—'}</span></td>
                              <td style={{ textAlign: 'center' }}>{product.quantity || 0}</td>
                              <td style={{ textAlign: 'right', fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--accent-primary)' }}>
                                ₹{Number(product.price).toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  className="table-action-btn edit-btn"
                                  onClick={() => startEditing(product)}
                                  title="Edit product"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="table-action-btn delete-btn"
                                  onClick={() => deleteProduct(product.id)}
                                  disabled={deleting}
                                  title="Delete product"
                                  style={{ color: '#e74c3c', marginLeft: '0.25rem' }}
                                >
                                  🗑️
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
