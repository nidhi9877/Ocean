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

    // Filter out completely empty rows
    const validRows = rows.filter(r => r.productName && r.category && r.price);
    
    if (validRows.length === 0) {
      setError('Please fill in at least one product with name, category, and price.');
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
    padding: '0.5rem',
    border: '1px solid rgba(255,255,255,0.2)',
  };

  const inputStyle = {
    width: '100%',
    minWidth: '120px',
    padding: '0.4rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    borderRadius: '4px',
    outline: 'none',
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

      <div className="page-container" style={{ padding: '6rem 2rem 2rem' }}>
        <div className="glass-card" style={{ maxWidth: '100%', overflowX: 'auto', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', color: 'white' }}>Excel Data Entry</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Fill out the details below as you would in an Excel sheet. Name, Category, and Price are required for valid products.
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {loading ? (
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <th style={tdStyle}>Sr. No</th>
                      <th style={tdStyle}>Company Name</th>
                      <th style={tdStyle}>Product ID</th>
                      <th style={tdStyle}>Product Name</th>
                      <th style={tdStyle}>Description</th>
                      <th style={tdStyle}>Category</th>
                      <th style={tdStyle}>Brand</th>
                      <th style={tdStyle}>Model Number</th>
                      <th style={tdStyle}>Part Number</th>
                      <th style={tdStyle}>Manufactured At</th>
                      <th style={tdStyle}>Location</th>
                      <th style={tdStyle}>Quantity</th>
                      <th style={tdStyle}>Price (₹)</th>
                      <th style={tdStyle}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td style={tdStyle}>{row.srNo}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }} onClick={addMoreRows}>
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
