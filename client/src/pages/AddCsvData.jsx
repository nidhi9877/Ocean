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

  // EXPECTED_MANDATORY_COLS is replaced by smart detection below

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

          // Map CSV columns to the API expected keys (same as getEmptyRow in AddBulkData)
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
          // Upload to backend
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
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
          <div className="particle"></div><div className="particle"></div><div className="particle"></div>
        </div>
      </div>
      
      <Navbar />

      <div className="page-container" style={{ padding: '6rem 2rem 2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ maxWidth: '800px', width: '100%', padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Upload CSV File
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
            Select your CSV spreadsheet with spare products data. Our smart detection will automatically find your columns, even if named slightly differently (e.g. "Item Price", "Cost", "qty").
          </p>

          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
             <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Mandatory Columns (Must include data for every row):</h4>
             <ul style={{ color: 'var(--text-secondary)', marginBottom: '1rem', marginLeft: '1.5rem' }}>
               <li><strong style={{ color: '#ff6b6b' }}>Product Name</strong></li>
               <li><strong style={{ color: '#ff6b6b' }}>Category</strong></li>
               <li><strong style={{ color: '#ff6b6b' }}>Price</strong></li>
             </ul>
             <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Optional Supported Columns:</h4>
             <ul style={{ color: 'var(--text-muted)', marginLeft: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
               <li>Company Name</li>
               <li>Product ID</li>
               <li>Description</li>
               <li>Brand</li>
               <li>Model Number</li>
               <li>Part Number</li>
               <li>Manufactured At</li>
               <li><strong style={{ color: 'var(--teal-accent)' }}>To which location you can supply the product</strong></li>
               <li>Quantity</li>
               <li>Email</li>
               <li><strong style={{ color: 'var(--teal-accent)' }}>Additional Information</strong></li>
             </ul>
          </div>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div style={{ border: file ? '2px solid var(--teal-accent)' : '2px dashed rgba(255,255,255,0.2)', padding: '3rem 2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', position: 'relative' }}>
               <input 
                 type="file" 
                 accept=".csv" 
                 onChange={handleFileChange} 
                 style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
               />
               <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
               <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                 {file ? file.name : "Click to select a CSV file or drag and drop"}
               </h4>
               <p style={{ color: 'var(--text-muted)' }}>Only .csv files are supported for bulk upload</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/provider/add-options')} style={{ flex: 1 }}>
                Back
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
