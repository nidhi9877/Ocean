import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AddDataOptions() {
  const navigate = useNavigate();

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
        <div className="glass-card" style={{ maxWidth: '800px', width: '100%', padding: '3rem', textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            How would you like to add products?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.2rem' }}>
            Choose a method to upload your spare products inventory.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            
            {/* CSV Upload Option */}
            <div 
              className="glass-card hover-lift" 
              style={{ padding: '2.5rem 1.5rem', cursor: 'pointer', transition: 'all 0.3s ease', background: 'rgba(255,255,255, 0.05)', border: '1px solid rgba(255,255,255, 0.1)' }}
              onClick={() => navigate('/provider/add-csv')}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255, 0.05)'}
            >
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Upload CSV File</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Fastest way for bulk uploads. Upload your existing inventory spreadsheet directly.
              </p>
              <button className="btn btn-primary" style={{ marginTop: '2rem', width: '100%' }}>Select & Upload File</button>
            </div>

            {/* Manual Entry Option */}
            <div 
              className="glass-card hover-lift" 
              style={{ padding: '2.5rem 1.5rem', cursor: 'pointer', transition: 'all 0.3s ease', background: 'rgba(255,255,255, 0.05)', border: '1px solid rgba(255,255,255, 0.1)' }}
              onClick={() => navigate('/provider/add-data')}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255, 0.05)'}
            >
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✍️</div>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Add Manually</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Use our built-in spreadsheet-like interface to enter your products one by one.
              </p>
              <button className="btn btn-secondary" style={{ marginTop: '2rem', width: '100%' }}>Enter Manually</button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
