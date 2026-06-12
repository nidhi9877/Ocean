import { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

const API = '/api';

export default function UploadModal({ onClose, onSuccess }) {
  const { token, user } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfMessage, setPdfMessage] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError('');
      
      if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setPdfMessage(true);
      } else {
        setPdfMessage(false);
      }
    }
  };

  const processData = async (data, metaFields = null) => {
    // Smart column detection
    const findCol = (row, possibleNames) => {
      const keys = metaFields || Object.keys(row);
      return keys.find(f => {
        const norm = f.toLowerCase().replace(/[^a-z0-9]/g, '');
        return possibleNames.includes(norm);
      });
    };

    if (data.length === 0) {
      setError('No data found in the file.');
      setLoading(false);
      return;
    }

    const firstRow = data[0];
    const colEquipment = findCol(firstRow, ['equipment', 'category']);
    const colManufacturer = findCol(firstRow, ['manufacturer', 'brand']);
    const colModelNumber = findCol(firstRow, ['modelnumber', 'model']);
    const colYearOfManufacturer = findCol(firstRow, ['yearofmanufacturer', 'year', 'manufacturedat']);
    const colPartName = findCol(firstRow, ['partname', 'productname', 'item']);
    const colPartNumer = findCol(firstRow, ['partnumer', 'partnumber', 'pn']);
    const colStockLocation = findCol(firstRow, ['stocklocation', 'location']);
    const colQunatity = findCol(firstRow, ['qunatity', 'quantity', 'qty']);

    const validProducts = [];
    let skippedRows = 0;

    for (const row of data) {
      const hasAnyData = Object.values(row).some(v => v && v.toString().trim());
      if (!hasAnyData) {
        skippedRows++;
        continue;
      }

      const qtyVal = colQunatity ? row[colQunatity] : null;
      const qty = qtyVal ? Number(qtyVal) : 0;
      if (!qty || qty <= 0) {
        skippedRows++;
        continue;
      }

      validProducts.push({
        companyName: user?.username || '',
        productId: '',
        productName: colPartName ? (row[colPartName] || '') : '',
        description: '',
        category: colEquipment ? (row[colEquipment] || '') : '',
        brand: colManufacturer ? (row[colManufacturer] || '') : '',
        modelNumber: colModelNumber ? (row[colModelNumber] || '') : '',
        partNumber: colPartNumer ? (row[colPartNumer] || '') : '',
        manufacturedAt: colYearOfManufacturer ? (row[colYearOfManufacturer] || '') : '',
        location: colStockLocation ? (row[colStockLocation] || '') : '',
        quantity: qty,
        price: '0',
        email: user?.email || '',
        additionalInfo: ''
      });
    }

    if (validProducts.length === 0) {
      setError('No valid products found! Make sure at least some rows have a quantity greater than 0.');
      setLoading(false);
      return;
    }

    try {
      await axios.post(
        `${API}/provider/bulk-products`,
        { products: validProducts },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuccess(validProducts.length, skippedRows);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload products.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file || pdfMessage) return;

    setLoading(true);
    setError('');

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data, results.meta.fields);
        },
        error: (parseError) => {
          setError("Error parsing CSV: " + parseError.message);
          setLoading(false);
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          processData(data);
        } catch (err) {
          setError("Error parsing Excel file.");
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Error reading file.");
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } else {
      setError("Unsupported file format. Please upload CSV or Excel.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-card" style={{ maxWidth: '550px', width: '90%', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'none',
          border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)'
        }}>✕</button>
        
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Master Upload
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Upload your existing inventory spreadsheet. We support Excel (.xlsx, .xls) and CSV files.
        </p>

        <form onSubmit={handleUpload}>
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          
          <div style={{ 
            border: file ? '2px solid var(--accent-primary)' : '2px dashed var(--border-color)', 
            padding: '2.5rem 2rem', borderRadius: 'var(--radius-md)', 
            background: file ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-surface)', 
            cursor: 'pointer', position: 'relative', textAlign: 'center', transition: 'all 0.3s ease',
            marginBottom: '1.5rem'
          }}>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls, .pdf" 
              onChange={handleFileChange} 
              style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📁</div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem', fontSize: '1rem' }}>
              {file ? file.name : "Click to select a file or drag and drop"}
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supports .csv, .xlsx, .xls</p>
          </div>

          {pdfMessage && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <strong>PDF Detected:</strong> To ensure accurate extraction of your tabular data, please convert your PDF to an Excel file using a free tool before uploading.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!file || loading || pdfMessage} style={{ padding: '0.5rem 1.5rem' }}>
              {loading ? 'Processing...' : 'Upload & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
