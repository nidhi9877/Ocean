import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = 'http://localhost:5000/api';

export default function AddCsvData() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const EXPECTED_MANDATORY_COLS = ["Product Name", "Category", "Price"];

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

        // Check for mandatory headers
        const missingMandatory = EXPECTED_MANDATORY_COLS.filter(col => !meta.fields.includes(col));
        if (missingMandatory.length > 0) {
          setError(`Missing mandatory columns: ${missingMandatory.join(', ')}`);
          setLoading(false);
          return;
        }

        // Validate data logic
        const validProducts = [];
        let missingDataErrors = 0;

        for (const row of data) {
          if (!row["Product Name"] || !row["Category"] || !row["Price"]) {
            missingDataErrors++;
            continue;
          }

          // Map CSV columns to the API expected keys (same as getEmptyRow in AddBulkData)
          validProducts.push({
            companyName: row["Company Name"] || '',
            productId: row["Product ID"] || '',
            productName: row["Product Name"] || '',
            description: row["Description"] || '',
            category: row["Category"] || '',
            brand: row["Brand"] || '',
            modelNumber: row["Model Number"] || '',
            partNumber: row["Part Number"] || '',
            manufacturedAt: row["Manufactured At"] || '',
            location: row["To which location you can supply the product"] || '',
            quantity: row["Quantity"] || '',
            price: row["Price"] || '',
            email: row["Email"] || user?.email || '',
            additionalInfo: row["Additional Information"] || ''
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
            Select your CSV spreadsheet with spare products data. The following columns must be strictly named as shown below.
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
