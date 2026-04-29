import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

const DEFAULT_ROWS = 5;

export default function AddBulkData() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/provider/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const p = res.data.provider;
      setProvider(p);
      
      // Initialize rows with provider defaults
      const initialRows = Array.from({ length: DEFAULT_ROWS }, (_, i) => getEmptyRow(i + 1, p));
      setRows(initialRows);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const getEmptyRow = (srNo, p) => ({
    srNo,
    companyName: p ? p.company_name : '',
    productId: '',
    productName: '',
    description: '',
    category: '',
    brand: '',
    modelNumber: '',
    partNumber: '',
    manufacturedAt: '',
    location: '',
    quantity: '',
    price: '',
    email: p ? p.email : user?.email || '',
    additionalInfo: '',
  });

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const addMoreRows = () => {
    const newRows = Array.from({ length: 3 }, (_, i) => getEmptyRow(rows.length + i + 1, provider));
    setRows([...rows, ...newRows]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Filter out completely empty rows, and skip rows with zero/missing quantity
    const validRows = rows.filter(r => {
      const hasAnyData = r.productName || r.category || r.price || r.brand || r.partNumber;
      const qty = Number(r.quantity);
      return hasAnyData && qty > 0;
    });
    
    if (validRows.length === 0) {
      setError('Please fill in at least one product with a quantity/stock greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${API}/provider/bulk-products`,
        { products: validRows },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(`Successfully added ${validRows.length} products!`);
      setTimeout(() => navigate('/provider/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add products.');
    } finally {
      setSubmitting(false);
    }
  };

  const tdStyle = {
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border-color)',
  };

  const inputStyle = {
    width: '100%',
    minWidth: '110px',
    padding: '0.4rem 0.5rem',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '4px',
    outline: 'none',
    fontSize: '0.85rem',
    transition: 'border-color 0.15s ease',
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-container" style={{ paddingTop: '88px' }}>
        <div className="glass-card" style={{ overflowX: 'auto', padding: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem', fontFamily: "'Outfit', sans-serif", background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Excel Data Entry</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Fill out the details below as you would in an Excel sheet. Products with zero or empty stock/quantity will be skipped.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {loading ? (
            <div className="spinner" style={{ margin: '2rem auto', width: '40px', height: '40px' }}></div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                <table className="data-table" style={{ minWidth: '1400px' }}>
                  <thead>
                    <tr>
                      <th style={tdStyle}>Sr.</th>
                      <th style={tdStyle}>Company Name</th>
                      <th style={tdStyle}>Product ID</th>
                      <th style={tdStyle}>Product Name</th>
                      <th style={tdStyle}>Description</th>
                      <th style={tdStyle}>Category</th>
                      <th style={tdStyle}>Brand</th>
                      <th style={tdStyle}>Model No.</th>
                      <th style={tdStyle}>Part No.</th>
                      <th style={tdStyle}>Manufactured At</th>
                      <th style={tdStyle}>Supply Location</th>
                      <th style={tdStyle}>Qty *</th>
                      <th style={tdStyle}>Price</th>
                      <th style={tdStyle}>Email</th>
                      <th style={tdStyle}>Additional Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>{row.srNo}</td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.companyName} onChange={e => handleRowChange(index, 'companyName', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.productId} onChange={e => handleRowChange(index, 'productId', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.productName} onChange={e => handleRowChange(index, 'productName', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.description} onChange={e => handleRowChange(index, 'description', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.category} onChange={e => handleRowChange(index, 'category', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.brand} onChange={e => handleRowChange(index, 'brand', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.modelNumber} onChange={e => handleRowChange(index, 'modelNumber', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.partNumber} onChange={e => handleRowChange(index, 'partNumber', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.manufacturedAt} onChange={e => handleRowChange(index, 'manufacturedAt', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.location} onChange={e => handleRowChange(index, 'location', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input type="number" style={inputStyle} value={row.quantity} onChange={e => handleRowChange(index, 'quantity', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input type="number" step="0.01" style={inputStyle} value={row.price} onChange={e => handleRowChange(index, 'price', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} type="email" value={row.email} onChange={e => handleRowChange(index, 'email', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.additionalInfo} onChange={e => handleRowChange(index, 'additionalInfo', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-secondary" onClick={addMoreRows}>
                  + Add More Rows
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Data'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
