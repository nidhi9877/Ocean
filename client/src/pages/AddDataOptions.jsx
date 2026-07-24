import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AddDataOptions() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <div className="page-container page-with-nav" style={{ alignItems: 'center' }}>
        <div className="content-container-xl" style={{ maxWidth: '800px' }}>
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2rem', marginBottom: '0.75rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              How would you like to add products?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.05rem' }}>
              Choose a method to upload your spare products inventory.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              
              {/* CSV Upload Option */}
              <div 
                className="glass-card" 
                style={{ padding: '2rem 1.5rem', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                onClick={() => navigate('/provider/add-csv')}
              >
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📄</div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontFamily: "'Outfit', sans-serif" }}>Upload CSV File</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Fastest way for bulk uploads. Upload your existing inventory spreadsheet directly.
                </p>
                <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>Select & Upload File</button>
              </div>

              {/* Manual Entry Option */}
              <div 
                className="glass-card" 
                style={{ padding: '2rem 1.5rem', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
                onClick={() => navigate('/provider/add-data')}
              >
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✍️</div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontFamily: "'Outfit', sans-serif" }}>Add Manually</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Use our built-in spreadsheet-like interface to enter your products one by one.
                </p>
                <button className="btn btn-secondary" style={{ marginTop: '1.5rem', width: '100%' }}>Enter Manually</button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
