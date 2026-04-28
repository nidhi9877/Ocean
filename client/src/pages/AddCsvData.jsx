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

        const colProductName = findCol(['productname', 'name', 'itemname', 'title', 'producttitle']);
        const colCategory = findCol(['category', 'type', 'department', 'productcategory']);
        const colPrice = findCol(['price', 'cost', 'amount', 'rate', 'mrp', 'unitprice']);
        
        const colCompanyName = findCol(['companyname', 'company', 'vendor', 'business']);
        const colProductId = findCol(['productid', 'id', 'itemid', 'sku']);
        const colDescription = findCol(['description', 'details', 'about', 'desc']);
        const colBrand = findCol(['brand', 'manufacturer', 'make']);
        const colModelNumber = findCol(['modelnumber', 'model', 'modelno']);
        const colPartNumber = findCol(['partnumber', 'part', 'partno']);
        const colManufacturedAt = findCol(['manufacturedat', 'manufacturingdate', 'mfgdate', 'date']);
        const colLocation = findCol(['location', 'supplylocation', 'towhichlocationyoucansupplytheproduct', 'city', 'state', 'supply']);
        const colQuantity = findCol(['quantity', 'qty', 'stock', 'count']);
        const colEmail = findCol(['email', 'emailaddress', 'contactemail', 'contact']);
        const colAdditionalInfo = findCol(['additionalinformation', 'additionalinfo', 'info', 'notes', 'remarks']);

        const missingMandatory = [];
        if (!colProductName) missingMandatory.push("Product Name");
        if (!colCategory) missingMandatory.push("Category");
        if (!colPrice) missingMandatory.push("Price");

        if (missingMandatory.length > 0) {
          setError(`Could not detect mandatory columns: ${missingMandatory.join(', ')}. Please check your CSV headers.`);
          setLoading(false);
          return;
        }

        // Validate data logic
        const validProducts = [];
        let missingDataErrors = 0;

        for (const row of data) {
          if (!row[colProductName] || !row[colCategory] || !row[colPrice]) {
            missingDataErrors++;
            continue;
          }

          validProducts.push({
            companyName: colCompanyName ? (row[colCompanyName] || '') : '',
            productId: colProductId ? (row[colProductId] || '') : '',
            productName: row[colProductName] || '',
            description: colDescription ? (row[colDescription] || '') : '',
            category: row[colCategory] || '',
            brand: colBrand ? (row[colBrand] || '') : '',
            modelNumber: colModelNumber ? (row[colModelNumber] || '') : '',
            partNumber: colPartNumber ? (row[colPartNumber] || '') : '',
            manufacturedAt: colManufacturedAt ? (row[colManufacturedAt] || '') : '',
            location: colLocation ? (row[colLocation] || '') : '',
            quantity: colQuantity ? (row[colQuantity] || '') : '',
            price: row[colPrice] || '',
            email: (colEmail && row[colEmail]) ? row[colEmail] : (user?.email || ''),
            additionalInfo: colAdditionalInfo ? (row[colAdditionalInfo] || '') : ''
          });
        }

        if (validProducts.length === 0) {
          setError('No valid products found! Make sure the mandatory columns have data in every row.');
          setLoading(false);
          return;
        }

        try {
          await axios.post(
            `${API}/provider/bulk-products`,
            { products: validProducts },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (missingDataErrors > 0) {
            setSuccess(`Success! Uploaded ${validProducts.length} products. Skipped ${missingDataErrors} rows missing mandatory details.`);
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '1rem', textAlign: 'center' }}>
            Select your CSV spreadsheet with spare products data. Our smart detection will automatically find your columns.
          </p>

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
