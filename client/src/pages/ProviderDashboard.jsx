import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UploadModal from '../components/UploadModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API = '/api';

export default function ProviderDashboard() {
  const { user, token } = useAuth();
  const [provider, setProvider] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIds, setEditingIds] = useState([]);
  const [editDataMap, setEditDataMap] = useState({});
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const spreadsheetRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Click outside spreadsheet to deselect all — like Excel
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (spreadsheetRef.current && !spreadsheetRef.current.contains(e.target)) {
        // Deselect single-clicked rows
        setSelectedIds([]);
        
        // If editing individual rows (not bulk "Edit All" mode), discard edits when clicking outside
        if (!isBulkEditing) {
          setEditingIds([]);
          setEditDataMap({});
          // Remove any newly added unsaved temporary rows
          setProducts(prev => prev.filter(p => !String(p.id).startsWith('temp_')));
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBulkEditing]);

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

  const startBulkEdit = () => {
    setIsBulkEditing(true);
    const newEditDataMap = {};
    products.forEach(p => {
      newEditDataMap[p.id] = {
        product_name: p.product_name || '',
        category: p.category || '',
        part_number: p.part_number || '',
        brand: p.brand || '',
        model_number: p.model_number || '',
        location: p.location || '',
        quantity: p.quantity || 0,
        price: p.price || 0,
        description: p.description || '',
        manufactured_at: p.manufactured_at || '',
        additional_info: p.additional_info || '',
        service_type: p.service_type || 'Supply',
        id: p.id
      };
    });
    setEditingIds(products.map(p => p.id));
    setEditDataMap(newEditDataMap);
  };

  const startEditSelected = () => {
    if (selectedIds.length === 0) return;
    setIsBulkEditing(false);
    const newEditDataMap = {};
    products.forEach(p => {
      if (selectedIds.includes(p.id)) {
        newEditDataMap[p.id] = {
          product_name: p.product_name || '',
          category: p.category || '',
          part_number: p.part_number || '',
          brand: p.brand || '',
          model_number: p.model_number || '',
          location: p.location || '',
          quantity: p.quantity || 0,
          price: p.price || 0,
          description: p.description || '',
          manufactured_at: p.manufactured_at || '',
          additional_info: p.additional_info || '',
          service_type: p.service_type || 'Supply',
          id: p.id
        };
      }
    });
    setEditingIds(selectedIds);
    setEditDataMap(newEditDataMap);
  };


  const startEditingRow = (product) => {
    // Don't allow toggling individual rows during bulk edit
    if (isBulkEditing) return;
    if (editingIds.includes(product.id)) {
      // Double-click again on same row → exit edit mode for that row
      setEditingIds(prev => prev.filter(id => id !== product.id));
      setEditDataMap(prev => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
    } else {
      // Double-click on a new row → clear selection, edit ONLY this row
      setSelectedIds([]);
      setEditingIds([product.id]);
      setEditDataMap({
        [product.id]: {
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
          service_type: product.service_type || 'Supply',
          id: product.id
        }
      });
    }
  };

  const cancelBulkEdits = () => {
    setIsBulkEditing(false);
    setEditingIds([]);
    setEditDataMap({});
    // Remove any unsaved temporary rows
    setProducts(prev => prev.filter(p => !String(p.id).startsWith('temp_')));
  };

  const addNewRow = () => {
    const tempId = `temp_${Date.now()}`;
    const newRow = {
      id: tempId,
      product_name: '',
      category: '',
      brand: '',
      model_number: '',
      part_number: '',
      manufactured_at: '',
      location: '',
      quantity: 1,
      price: 0,
      description: '',
      additional_info: '',
      service_type: 'Supply'
    };
    
    // Add to products
    setProducts(prev => [newRow, ...prev]);
    
    // Auto-enter edit mode for this row
    setEditingIds(prev => [...prev, tempId]);
    setEditDataMap(prev => ({
      ...prev,
      [tempId]: { ...newRow }
    }));
  };

  const handleBulkEditChange = (id, field, value) => {
    setEditDataMap(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const saveBulkEdits = async () => {
    setSaving(true);
    try {
      const updatedProducts = editingIds.map(id => editDataMap[id]);
      await axios.post(`${API}/provider/products/bulk-update`, { products: updatedProducts }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Refetch profile to get the real database IDs for any newly inserted rows
      await fetchProfile();
      
      setIsBulkEditing(false);
      setEditingIds([]);
      setEditDataMap({});
    } catch (err) {
      console.error('Failed to update products:', err);
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
    // If user starts selecting rows, exit any individual row edits
    if (editingIds.length > 0 && !isBulkEditing) {
      setEditingIds([]);
      setEditDataMap({});
    }
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    // If it's a temporary unsaved row, just remove it from frontend
    if (String(id).startsWith('temp_')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      return;
    }

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
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setDeleting(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/provider/products/bulk-delete`, { ids: realIds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete products');
    } finally {
      setDeleting(false);
    }
  };

  const bulkUpdateServiceType = async (serviceType) => {
    if (selectedIds.length === 0) return;
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setSaving(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/provider/products/bulk-update-service-type`, { ids: realIds, serviceType }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, service_type: serviceType } : p));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to update service type');
    } finally {
      setSaving(false);
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

  const downloadCSV = () => {
    if (products.length === 0) return;
    
    // Headers: Equipment, Manufacturer, Model number, year of manufacturer, Part Name, Part Numer, Stock location, Qunatity, Service Type
    const headers = ['Equipment', 'Manufacturer', 'Model number', 'year of manufacturer', 'Part Name', 'Part Numer', 'Stock location', 'Qunatity', 'Service Type'];
    
    const rows = products.map(p => [
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.manufactured_at || '',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'provider_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const highlightText = (text, query) => {
    if (!query || text === undefined || text === null || text === '') return text || '—';
    const strText = String(text);
    if (!strText) return '—';
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = strText.split(regex);
    
    if (parts.length === 1) return strText;
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: '#fef08a', color: '#854d0e', borderRadius: '2px', padding: '0 2px', fontWeight: 600 }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const downloadExcel = () => {
    if (products.length === 0) return;
    const headers = ['Equipment', 'Manufacturer', 'Model number', 'year of manufacturer', 'Part Name', 'Part Numer', 'Stock location', 'Qunatity', 'Service Type'];
    const rows = products.map(p => [
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.manufactured_at || '',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply'
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "provider_products.xlsx");
  };

  const downloadPDF = () => {
    if (products.length === 0) return;
    const doc = new jsPDF();
    const headers = [['Equipment', 'Manufacturer', 'Model', 'Year', 'Part Name', 'Part No.', 'Location', 'Qty', 'Service']];
    const rows = products.map(p => [
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.manufactured_at || '',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply'
    ]);
    
    doc.autoTable({
      head: headers,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save('provider_products.pdf');
  };

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const editInput = (id, field, style = {}) => (
    <input
      className="inline-edit-input"
      value={editDataMap[id]?.[field] || ''}
      onChange={(e) => handleBulkEditChange(id, field, e.target.value)}
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
          <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={products.length === 0}
            >
              ⬇️ Download Data
            </button>
            
            {showDownloadMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.5rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
                overflow: 'hidden'
              }}>
                <button className="menu-item-btn" onClick={() => { downloadCSV(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📄 Download CSV</button>
                <button className="menu-item-btn" onClick={() => { downloadExcel(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📊 Download Excel</button>
                <button className="menu-item-btn" onClick={() => { downloadPDF(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📑 Download PDF</button>
              </div>
            )}

            <button 
              className="btn btn-primary"
              onClick={() => setShowUploadModal(true)}
            >
              📤 Master Upload
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

            {/* ===== Excel-like Spreadsheet ===== */}
            <div style={{ marginTop: '0.5rem' }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
                Your Products
              </h2>

              {products.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No products listed yet.</p>
              ) : (
                <div ref={spreadsheetRef} style={{ animation: 'slideUp 0.5s ease-out' }}>
                  {/* Search Bar - above toolbar */}
                  <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <input 
                      type="text" 
                      placeholder="🔍 Search parts, categories, brands..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.85rem', 
                        borderRadius: '4px', 
                        border: '1px solid #b0b8c8', 
                        width: '250px',
                        outline: 'none',
                        fontFamily: "'Inter', sans-serif"
                      }}
                    />
                  </div>

                  {/* Spreadsheet Toolbar — like Excel's ribbon */}
                  <div className="spreadsheet-toolbar">
                    {isBulkEditing || editingIds.length > 0 ? (
                      <>
                        <button className="toolbar-btn toolbar-btn-success" onClick={saveBulkEdits} disabled={saving}>
                          {saving ? '⏳ Saving...' : '💾 Save'}
                        </button>
                        <button className="toolbar-btn" onClick={cancelBulkEdits} disabled={saving}>
                          ✕ Cancel
                        </button>
                        <div className="toolbar-separator" />
                        <button className="toolbar-btn" onClick={addNewRow} disabled={saving}>
                          ➕ Add Row
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedIds.length === 0 && (
                          <>
                            <button className="toolbar-btn toolbar-btn-primary" onClick={startBulkEdit}>
                              ✏️ Edit All
                            </button>
                            <button className="toolbar-btn" onClick={addNewRow}>
                              ➕ Add Row
                            </button>
                          </>
                        )}

                        {selectedIds.length > 0 && (
                          <>
                            <button className="toolbar-btn toolbar-btn-primary" onClick={startEditSelected}>
                              ✏️ Edit Selected
                            </button>
                            <div className="toolbar-separator" />
                            <button className="toolbar-btn" onClick={() => bulkUpdateServiceType('Supply')} disabled={saving}>
                              Supply
                            </button>
                            <button className="toolbar-btn" onClick={() => bulkUpdateServiceType('Supply and Service')} disabled={saving}>
                              Supply & Svc
                            </button>
                            <button className="toolbar-btn toolbar-btn-danger" onClick={bulkDelete} disabled={deleting}>
                              🗑️ Delete
                            </button>
                          </>
                        )}

                        <div className="toolbar-separator" />

                        {selectedIds.length < products.length && (
                          <button className="toolbar-btn" onClick={() => {
                            setSelectedIds(products.map(p => p.id));
                          }}>
                            ☑ Select All
                          </button>
                        )}
                      </>
                    )}

                    <span className="toolbar-info">
                      {selectedIds.length > 0 ? `${selectedIds.length} of ${products.length} selected` : `${products.length} rows`}
                      {editingIds.length > 0 ? ` · ${editingIds.length} editing` : ''}
                    </span>
                  </div>

                  {/* The Spreadsheet Grid */}
                  <div className="provider-products-table-wrap" style={{ borderTop: 'none', borderRadius: '0' }}>
                    <table className="data-table provider-products-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Equipment</th>
                          <th>Manufacturer</th>
                          <th>Model Number</th>
                          <th>Year of Mfg</th>
                          <th>Part Name</th>
                          <th>Part Number</th>
                          <th>Stock Location</th>
                          <th>Quantity</th>
                          <th>Service Type</th>
                          <th style={{ width: '45px', minWidth: '45px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.filter(p => {
                          if (!searchQuery) return true;
                          const q = searchQuery.toLowerCase();
                          return (
                            (p.product_name && p.product_name.toLowerCase().includes(q)) ||
                            (p.category && p.category.toLowerCase().includes(q)) ||
                            (p.brand && p.brand.toLowerCase().includes(q)) ||
                            (p.model_number && p.model_number.toLowerCase().includes(q)) ||
                            (p.part_number && p.part_number.toLowerCase().includes(q)) ||
                            (p.location && p.location.toLowerCase().includes(q)) ||
                            (p.manufactured_at && String(p.manufactured_at).toLowerCase().includes(q)) ||
                            (p.service_type && p.service_type.toLowerCase().includes(q)) ||
                            (p.quantity !== undefined && p.quantity !== null && String(p.quantity).includes(q))
                          );
                        }).map((product, idx) => {
                          const isEditingThisRow = isBulkEditing || editingIds.includes(product.id);
                          const isSelected = selectedIds.includes(product.id);
                          const rowClasses = [
                            isEditingThisRow ? 'editing-row' : '',
                            isSelected ? 'spreadsheet-row-selected' : ''
                          ].filter(Boolean).join(' ');
                          return (
                          <tr
                            key={product.id}
                            className={rowClasses}
                            onClick={(e) => {
                              if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && !isEditingThisRow) {
                                handleSelect(product.id);
                              }
                            }}
                            onDoubleClick={() => startEditingRow(product)}
                          >
                            <td>{idx + 1}</td>

                            {isEditingThisRow ? (
                              <>
                                <td>{editInput(product.id, 'category')}</td>
                                <td>{editInput(product.id, 'brand')}</td>
                                <td>{editInput(product.id, 'model_number')}</td>
                                <td>{editInput(product.id, 'manufactured_at')}</td>
                                <td>{editInput(product.id, 'product_name')}</td>
                                <td>{editInput(product.id, 'part_number')}</td>
                                <td>{editInput(product.id, 'location')}</td>
                                <td>{editInput(product.id, 'quantity', { width: '55px', textAlign: 'center' })}</td>
                                <td>
                                  <select className="inline-edit-input" value={editDataMap[product.id]?.service_type || 'Supply'} onChange={(e) => handleBulkEditChange(product.id, 'service_type', e.target.value)}>
                                    <option value="Supply">Supply</option>
                                    <option value="Supply and Service">Supply and Service</option>
                                  </select>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="table-action-btn delete-btn"
                                    onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }}
                                    disabled={deleting}
                                    title="Delete row"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{highlightText(product.category, searchQuery)}</td>
                                <td>{highlightText(product.brand, searchQuery)}</td>
                                <td>{highlightText(product.model_number, searchQuery)}</td>
                                <td>{highlightText(product.manufactured_at, searchQuery)}</td>
                                <td style={{ fontWeight: 600 }}>{highlightText(product.product_name, searchQuery)}</td>
                                <td>{highlightText(product.part_number, searchQuery)}</td>
                                <td><span className="location-cell" title={product.location || ''}>{highlightText(product.location, searchQuery)}</span></td>
                                <td style={{ textAlign: 'center' }}>{highlightText(product.quantity, searchQuery)}</td>
                                <td>{highlightText(product.service_type || 'Supply', searchQuery)}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className="table-action-btn delete-btn"
                                    onClick={(e) => { e.stopPropagation(); deleteProduct(product.id); }}
                                    disabled={deleting}
                                    title="Delete row"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>

                  {/* Status bar — like Excel's bottom bar */}
                  <div className="spreadsheet-statusbar">
                    <span>
                      {selectedIds.length > 0
                        ? `${selectedIds.length} row${selectedIds.length > 1 ? 's' : ''} selected`
                        : 'Click row to select · Double-click to edit'
                      }
                    </span>
                    <span>
                      Total Qty: {products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)}
                      {' · '}
                      {new Set(products.map(p => p.category)).size} categories
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Download Menu was here */}

            {showUploadModal && (
              <UploadModal 
                onClose={() => setShowUploadModal(false)}
                onSuccess={(count, skipped) => {
                  setShowUploadModal(false);
                  alert(`Successfully uploaded ${count} products!${skipped > 0 ? ` Skipped ${skipped} empty/invalid rows.` : ''}`);
                  fetchProfile();
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
