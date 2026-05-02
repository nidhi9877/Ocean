import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
    equipment: '',
    manufacturer: '',
    modelNumber: '',
    yearOfManufacturer: '',
    partName: '',
    partNumer: '',
    stockLocation: '',
    qunatity: '',
    mail: p ? p.email : user?.email || '',
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

    // Filter out completely empty rows, and skip rows with zero/missing qunatity
    const validRows = rows.filter(r => {
      const hasAnyData = r.equipment || r.manufacturer || r.modelNumber || r.partName || r.partNumer;
      const qty = Number(r.qunatity);
      return hasAnyData && qty > 0;
    }).map(r => ({
      // Map back to internal model fields for the API
      category: r.equipment,
      brand: r.manufacturer,
      modelNumber: r.modelNumber,
      manufacturedAt: r.yearOfManufacturer,
      productName: r.partName,
      partNumber: r.partNumer,
      location: r.stockLocation,
      quantity: r.qunatity,
      email: r.mail,
      // Default empty fields for old required ones just in case
      companyName: provider ? provider.company_name : '',
      productId: '',
      description: '',
      price: '0',
      additionalInfo: ''
    }));
    
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

  const getExportData = () => {
    return rows.filter(r => r.equipment || r.manufacturer || r.modelNumber || r.partName || r.partNumer).map(r => [
      r.equipment || '',
      r.manufacturer || '',
      r.modelNumber || '',
      r.yearOfManufacturer || '',
      r.partName || '',
      r.partNumer || '',
      r.stockLocation || '',
      r.qunatity || 0,
      r.mail || ''
    ]);
  };

  const downloadCSV = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to download');
    const headers = ['Equipment', 'Manufacturer', 'Model number', 'year of manufacturer', 'Part Name', 'Part Numer', 'Stock location', 'Qunatity', 'Mail'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'manual_entry_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to download');
    const headers = ['Equipment', 'Manufacturer', 'Model number', 'year of manufacturer', 'Part Name', 'Part Numer', 'Stock location', 'Qunatity', 'Mail'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manual Entry");
    XLSX.writeFile(wb, "manual_entry_data.xlsx");
  };

  const downloadPDF = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to download');
    const doc = new jsPDF();
    const headers = [['Equipment', 'Manufacturer', 'Model', 'Year', 'Part Name', 'Part No.', 'Location', 'Qty', 'Mail']];
    doc.autoTable({
      head: headers,
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save('manual_entry_data.pdf');
  };

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

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
                      <th style={tdStyle}>Equipment</th>
                      <th style={tdStyle}>Manufacturer</th>
                      <th style={tdStyle}>Model number</th>
                      <th style={tdStyle}>year of manufacturer</th>
                      <th style={tdStyle}>Part Name</th>
                      <th style={tdStyle}>Part Numer</th>
                      <th style={tdStyle}>Stock location</th>
                      <th style={tdStyle}>Qunatity *</th>
                      <th style={tdStyle}>Mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>{row.srNo}</td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.equipment} onChange={e => handleRowChange(index, 'equipment', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.manufacturer} onChange={e => handleRowChange(index, 'manufacturer', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.modelNumber} onChange={e => handleRowChange(index, 'modelNumber', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.yearOfManufacturer} onChange={e => handleRowChange(index, 'yearOfManufacturer', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.partName} onChange={e => handleRowChange(index, 'partName', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.partNumer} onChange={e => handleRowChange(index, 'partNumer', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} value={row.stockLocation} onChange={e => handleRowChange(index, 'stockLocation', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input type="number" style={inputStyle} value={row.qunatity} onChange={e => handleRowChange(index, 'qunatity', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={inputStyle} type="email" value={row.mail} onChange={e => handleRowChange(index, 'mail', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={addMoreRows}>
                    + Add More Rows
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    >
                      ⬇️ Download Data
                    </button>
                    {showDownloadMenu && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '0.5rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 10,
                        overflow: 'hidden',
                        minWidth: '180px'
                      }}>
                        <button type="button" onClick={() => { downloadCSV(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📄 Download CSV</button>
                        <button type="button" onClick={() => { downloadExcel(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📊 Download Excel</button>
                        <button type="button" onClick={() => { downloadPDF(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>📑 Download PDF</button>
                      </div>
                    )}
                  </div>
                </div>
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
