import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

export default function AddCsvData() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
      setSuccess('');
    }
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data, meta } = results;

        // Smart column detection
        const findCol = (possibleNames) => {
          return meta.fields.find(f => {
            const norm = f.toLowerCase().replace(/[^a-z0-9]/g, '');
            return possibleNames.includes(norm);
          });
        };

        const colEquipment = findCol(['equipment']);
        const colManufacturer = findCol(['manufacturer']);
        const colModelNumber = findCol(['modelnumber']);
        const colYearOfManufacturer = findCol(['yearofmanufacturer']);
        const colPartName = findCol(['partname']);
        const colPartNumer = findCol(['partnumer', 'partnumber']);
        const colStockLocation = findCol(['stocklocation']);
        const colQunatity = findCol(['qunatity', 'quantity']);
        const colMail = findCol(['mail', 'email']);

        // Build products from CSV rows — no mandatory column requirement
        const validProducts = [];
        let skippedRows = 0;

        for (const row of data) {
          // Skip completely empty rows
          const hasAnyData = Object.values(row).some(v => v && v.toString().trim());
          if (!hasAnyData) {
            skippedRows++;
            continue;
          }

          // Skip rows with zero or missing qunatity
          const qty = colQunatity ? Number(row[colQunatity]) : 0;
          if (!qty || qty <= 0) {
            skippedRows++;
            continue;
          }

          validProducts.push({
            // Mapped to internal model
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
            email: (colMail && row[colMail]) ? row[colMail] : (user?.email || ''),
            additionalInfo: ''
          });
        }

        if (validProducts.length === 0) {
          setError('No valid products found! Make sure at least some rows have a quantity/stock greater than 0.');
          setLoading(false);
          return;
        }

        try {
          await axios.post(
            `${API}/provider/bulk-products`,
            { products: validProducts },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (skippedRows > 0) {
            setSuccess(`Success! Uploaded ${validProducts.length} products. Skipped ${skippedRows} rows (empty or zero stock).`);
          } else {
            setSuccess(`Success! Uploaded ${validProducts.length} products successfully.`);
          }

          setTimeout(() => navigate('/provider/dashboard'), 2500);
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to upload products from CSV.');
        } finally {
          setLoading(false);
        }
      },
      error: (parseError) => {
        setError("Error parsing CSV: " + parseError.message);
        setLoading(false);
      }
    });
  };

  return (
    <>
      <Navbar />

      <div className="page-container page-with-nav" style={{ alignItems: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '800px', width: '100%', padding: '2.5rem' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2rem', marginBottom: '0.75rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center' }}>
            Upload CSV File
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1rem', textAlign: 'center' }}>
            Select your CSV spreadsheet with spare products data. Our smart detection will automatically find your columns.
          </p>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 0.5rem 0', textAlign: 'center' }}>
              📌 Mandatory Columns
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
              Your file must contain the following columns (case-insensitive):<br/>
              <strong>Equipment, Manufacturer, Model number, year of manufacturer, Part Name, Part Numer, Stock location, Qunatity, Mail</strong>
            </p>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
             <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>Need a template?</h4>
             <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Download our reference Excel sheet to see the exact format required for bulk upload.</p>
             <a 
               href="/vortex_inventory.xlsx" 
               download="vortex_inventory.xlsx"
               className="btn btn-secondary" 
               style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
             >
               ⬇️ Download Reference Sheet
             </a>
          </div>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div style={{ border: file ? '2px solid var(--accent-primary)' : '2px dashed var(--border-color)', padding: '2.5rem 2rem', borderRadius: 'var(--radius-md)', background: file ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-surface)', cursor: 'pointer', position: 'relative', textAlign: 'center', transition: 'all 0.3s ease' }}>
               <input 
                 type="file" 
                 accept=".csv" 
                 onChange={handleFileChange} 
                 style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
               />
               <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📁</div>
               <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem', fontSize: '1rem' }}>
                 {file ? file.name : "Click to select a CSV file or drag and drop"}
               </h4>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Only .csv files are supported for bulk upload</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/provider/add-options')} style={{ flex: 1 }}>
                ← Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={!file || loading} style={{ flex: 1 }}>
                {loading ? 'Uploading...' : 'Upload Data'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
