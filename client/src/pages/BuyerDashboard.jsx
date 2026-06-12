import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [allProducts, setAllProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sendingIds, setSendingIds] = useState(new Set());
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [emailData, setEmailData] = useState({ cc: '', bcc: '', subject: '', body: '' });
  // Inquiry-only fields (not for search)
  const [inquiryMeta, setInquiryMeta] = useState({ eta: '', etd: '', vesselName: '', destination: '' });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  const [filters, setFilters] = useState({
    equipment: [], manufacturer: [], modelNumber: '',
    stockLocation: [], minQty: 1, serviceType: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/provider/products`);
        setAllProducts(r.data.products || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Dynamic options from DB
  const equipmentOpts = useMemo(() => [...new Set(allProducts.map(p => p.category).filter(Boolean))], [allProducts]);
  const manufacturerOpts = useMemo(() => [...new Set(allProducts.map(p => p.brand).filter(Boolean))], [allProducts]);
  const locationOpts = useMemo(() => [...new Set(allProducts.map(p => p.location).filter(Boolean))], [allProducts]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.equipment.length) c++;
    if (filters.manufacturer.length) c++;
    if (filters.modelNumber) c++;
    if (filters.stockLocation.length) c++;
    if (filters.minQty > 1) c++;
    if (filters.serviceType) c++;
    return c;
  }, [filters]);

  const displayedProducts = useMemo(() => {
    if (!hasSearched) return [];
    const q = searchQuery.trim().toLowerCase();
    
    // Robust fuzzy match with Levenshtein
    const levenshtein = (a, b) => {
      if(!a.length) return b.length;
      if(!b.length) return a.length;
      const m = [];
      for(let i=0; i<=b.length; i++) m[i] = [i];
      for(let j=0; j<=a.length; j++) m[0][j] = j;
      for(let i=1; i<=b.length; i++){
        for(let j=1; j<=a.length; j++){
          if(b.charAt(i-1) === a.charAt(j-1)) m[i][j] = m[i-1][j-1];
          else m[i][j] = Math.min(m[i-1][j-1]+1, Math.min(m[i][j-1]+1, m[i-1][j]+1));
        }
      }
      return m[b.length][a.length];
    };

    const fuzzyMatch = (str, pattern) => {
      if (!pattern) return true;
      if (!str) return false;
      const s = String(str).toLowerCase();
      const p = pattern.toLowerCase().trim();
      if (s.includes(p)) return true;
      const sWords = s.split(/[\s-]+/);
      const pWords = p.split(/[\s-]+/);
      return pWords.every(pw => sWords.some(sw => {
        if (sw.includes(pw) || pw.includes(sw)) return true;
        const maxDist = pw.length <= 4 ? 1 : 2;
        return levenshtein(sw, pw) <= maxDist;
      }));
    };

    return allProducts.filter(p => {
      if (q && !(fuzzyMatch(p.product_name, q) || fuzzyMatch(p.part_number, q) || fuzzyMatch(p.category, q) || fuzzyMatch(p.brand, q))) return false;
      if (filters.equipment.length && !filters.equipment.includes(p.category)) return false;
      if (filters.manufacturer.length && !filters.manufacturer.includes(p.brand)) return false;
      if (filters.modelNumber && !fuzzyMatch(p.model_number, filters.modelNumber)) return false;
      if (filters.stockLocation.length && !filters.stockLocation.includes(p.location)) return false;
      if (filters.minQty > 1 && Number(p.quantity) < filters.minQty) return false;
      const sType = p.service_type || 'Supply';
      if (filters.serviceType && sType !== filters.serviceType) return false;
      return true;
    });
  }, [hasSearched, searchQuery, filters, allProducts]);

  // Shared fuzzy match logic for option filtering
  const getFuzzyMatch = () => {
    const levenshtein = (a, b) => {
      if(!a.length) return b.length;
      if(!b.length) return a.length;
      const m = [];
      for(let i=0; i<=b.length; i++) m[i] = [i];
      for(let j=0; j<=a.length; j++) m[0][j] = j;
      for(let i=1; i<=b.length; i++){
        for(let j=1; j<=a.length; j++){
          if(b.charAt(i-1) === a.charAt(j-1)) m[i][j] = m[i-1][j-1];
          else m[i][j] = Math.min(m[i-1][j-1]+1, Math.min(m[i][j-1]+1, m[i-1][j]+1));
        }
      }
      return m[b.length][a.length];
    };
    return (str, pattern) => {
      if (!pattern) return true;
      if (!str) return false;
      const s = String(str).toLowerCase();
      const p = pattern.toLowerCase().trim();
      if (s.includes(p)) return true;
      const sWords = s.split(/[\s-]+/);
      const pWords = p.split(/[\s-]+/);
      return pWords.every(pw => sWords.some(sw => {
        if (sw.includes(pw) || pw.includes(sw)) return true;
        return levenshtein(sw, pw) <= (pw.length <= 4 ? 1 : 2);
      }));
    };
  };

  const filteredEquipmentOpts = useMemo(() => {
    if (!equipmentSearch.trim()) {
      return equipmentOpts.filter(o => filters.equipment.includes(o));
    }
    return equipmentOpts.filter(o => getFuzzyMatch()(o, equipmentSearch));
  }, [equipmentOpts, equipmentSearch, filters.equipment]);

  const filteredManufacturerOpts = useMemo(() => {
    if (!manufacturerSearch.trim()) {
      return manufacturerOpts.filter(o => filters.manufacturer.includes(o));
    }
    return manufacturerOpts.filter(o => getFuzzyMatch()(o, manufacturerSearch));
  }, [manufacturerOpts, manufacturerSearch, filters.manufacturer]);

  const filteredLocationOpts = useMemo(() => {
    if (!locationSearch.trim()) {
      return locationOpts.filter(o => filters.stockLocation.includes(o));
    }
    return locationOpts.filter(o => getFuzzyMatch()(o, locationSearch));
  }, [locationOpts, locationSearch, filters.stockLocation]);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() && activeFilterCount === 0) { toast.error('Enter a search term or apply filters.'); return; }
    setHasSearched(true);
  };

  const toggleCheckbox = (field, value) => {
    setFilters(f => ({
      ...f, [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value]
    }));
  };

  const clearAll = () => { setFilters({ equipment:[], manufacturer:[], modelNumber:'', stockLocation:[], minQty:1, serviceType:'' }); };

  const handleSendInquiry = async () => {
    if (!selectedProduct) return;
    if (!inquiryMeta.destination.trim()) { toast.error('Set Destination Port in the inquiry details section.'); return; }
    if (sendingIds.has(selectedProduct.id)) return;
    setSendingIds(prev => new Set(prev).add(selectedProduct.id));
    try {
      await axios.post(`${API}/buyer/inquiries`, {
        selections: [{ provider_id: selectedProduct.provider_id, product_id: selectedProduct.id }],
        destination_location: inquiryMeta.destination.trim(),
        cc: emailData.cc ? emailData.cc.trim() : null,
        bcc: emailData.bcc ? emailData.bcc.trim() : null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      // Generate mailto link
      const to = selectedProduct.provider_email || '';
      const cc = emailData.cc ? `&cc=${encodeURIComponent(emailData.cc.trim())}` : '';
      const bcc = emailData.bcc ? `&bcc=${encodeURIComponent(emailData.bcc.trim())}` : '';
      
      const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}${cc}${bcc}`;
      
      // Open default system client
      window.location.href = mailtoLink;

      toast.success(`✅ Inquiry registered! Opening mail client to contact ${selectedProduct.company_name}...`, { duration: 5000 });
      setShowComposeModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send inquiry.');
    } finally {
      setSendingIds(prev => { const n = new Set(prev); n.delete(selectedProduct.id); return n; });
    }
  };

  const openComposeModal = (product) => {
    if (!inquiryMeta.destination.trim()) {
      toast.error('Set Destination Port in the inquiry details section first.');
      return;
    }
    setSelectedProduct(product);
    const subject = `🚢 Purchase Inquiry: ${product.product_name} — Vortex Marketplace`;
    const body = `Dear ${product.company_name} Team,\n\nI am interested in purchasing the following listed product:\n\n- Product: ${product.product_name}\n- Brand: ${product.brand || 'N/A'}\n- Model: ${product.model_number || 'N/A'}\n- Part Number: ${product.part_number || 'N/A'}\n\nDelivery Details:\n- Destination Port: ${inquiryMeta.destination.trim()}\n- ETA: ${inquiryMeta.eta || 'N/A'}\n- ETD: ${inquiryMeta.etd || 'N/A'}\n- Vessel Name: ${inquiryMeta.vesselName || 'N/A'}\n- Minimum Quantity Required: ${filters.minQty}\n\nPlease let me know if you can fulfill this request and provide a price quote.\n\nBest regards,\n${user?.username || 'Buyer'}`;
    
    setShowCc(false);
    setShowBcc(false);
    setEmailData({
      cc: '',
      bcc: '',
      subject,
      body
    });
    setShowComposeModal(true);
  };

  // Tabs removed as filter columns are now merged

  // ── Checkbox component ──
  const Checkbox = ({ checked, label, onChange }) => (
    <label style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.55rem 0.75rem', borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all 0.15s', background: checked ? 'rgba(37,99,235,0.06)' : 'transparent', border: `1.5px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color)'}` }}
      onMouseEnter={e => { if(!checked) e.currentTarget.style.borderColor='var(--border-hover)'; }}
      onMouseLeave={e => { if(!checked) e.currentTarget.style.borderColor='var(--border-color)'; }}>
      <input type="checkbox" style={{ display: 'none' }} checked={checked} onChange={onChange} />
      <div style={{ width:18, height:18, borderRadius:4, border: `2px solid ${checked?'var(--accent-primary)':'var(--border-color)'}`, background: checked?'var(--accent-primary)':'white', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', flexShrink:0 }}>
        {checked && <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <span style={{ fontSize:'0.88rem', fontWeight: checked?'600':'400', color: checked?'var(--accent-primary)':'var(--text-secondary)' }}>{label}</span>
    </label>
  );

  return (
    <>
      <Navbar />
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.8rem', fontWeight:'700' }}>Welcome, {user?.username} 👋</h1>
            <p style={{ color:'var(--text-secondary)', marginTop:'0.25rem' }}>Search marine spare parts and send inquiries directly to vendors.</p>
          </div>
          <a href="/buyer/inquiries" className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem' }}><span>📨</span> My Inquiries Inbox</a>
        </div>

        {/* Search Bar */}
        <div className="glass-card" style={{ padding:'1.5rem 2rem', marginBottom:'1.25rem' }}>
          <form onSubmit={handleSearch} style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, minWidth:'280px' }}>
              <span style={{ position:'absolute', left:'1rem', top:'50%', transform:'translateY(-50%)', fontSize:'1.15rem', color:'var(--text-muted)', pointerEvents:'none' }}>🔍</span>
              <input
                style={{ width:'100%', padding:'0.9rem 1.2rem 0.9rem 3rem', background:'var(--bg-surface)', border:'2px solid var(--border-color)', borderRadius:'var(--radius-full)', color:'var(--text-primary)', fontFamily:"'Inter',sans-serif", fontSize:'0.95rem', outline:'none', transition:'all 0.2s' }}
                placeholder="Search by Part Name, Number, Equipment, or Manufacturer..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={e => { e.target.style.borderColor='var(--accent-primary)'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor='var(--border-color)'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.8rem 1.4rem', background: activeFilterCount?'rgba(37,99,235,0.04)':'var(--bg-surface)', border:`2px solid ${activeFilterCount?'var(--accent-primary)':'var(--border-color)'}`, borderRadius:'var(--radius-full)', color: activeFilterCount?'var(--accent-primary)':'var(--text-secondary)', fontWeight:'600', fontSize:'0.9rem', cursor:'pointer', transition:'all 0.2s', fontFamily:"'Inter',sans-serif" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filters
              {activeFilterCount > 0 && <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'var(--accent-gradient)', color:'white', fontSize:'0.7rem', fontWeight:'700' }}>{activeFilterCount}</span>}
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding:'0.8rem 1.8rem', borderRadius:'var(--radius-full)' }}>Search</button>
          </form>

          {activeFilterCount > 0 && (
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.75rem' }}>
              {filters.equipment.map(v => <Chip key={`eq-${v}`} label={`Equipment: ${v}`} onRemove={() => toggleCheckbox('equipment',v)} />)}
              {filters.manufacturer.map(v => <Chip key={`mf-${v}`} label={`Brand: ${v}`} onRemove={() => toggleCheckbox('manufacturer',v)} />)}
              {filters.modelNumber && <Chip label={`Model: ${filters.modelNumber}`} onRemove={() => setFilters(f=>({...f,modelNumber:''}))} />}
              {filters.stockLocation.map(v => <Chip key={`sl-${v}`} label={`Location: ${v}`} onRemove={() => toggleCheckbox('stockLocation',v)} />)}
              {filters.minQty > 1 && <Chip label={`Min Qty: ${filters.minQty}`} onRemove={() => setFilters(f=>({...f,minQty:1}))} />}
              {filters.serviceType && <Chip label={`Service: ${filters.serviceType}`} onRemove={() => setFilters(f=>({...f,serviceType:''}))} />}
              <button onClick={clearAll} style={{ background:'none', border:'none', color:'var(--danger)', fontSize:'0.8rem', fontWeight:'600', cursor:'pointer', padding:'0.25rem 0.5rem' }}>Clear All</button>
            </div>
          )}
        </div>

        {/* Inquiry Details (ETA/ETD/Vessel/Destination) */}
        <div className="glass-card" style={{ padding:'1.25rem 1.5rem', marginBottom:'1.25rem' }}>
          <h4 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1rem', fontWeight:'600', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            📋 Inquiry Details <span style={{ fontSize:'0.75rem', fontWeight:'400', color:'var(--text-muted)' }}>(opens mail client with options)</span>
          </h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'0.75rem' }}>
            <div><label className="form-label">Destination Port *</label><input className="form-input" placeholder="e.g., Singapore" value={inquiryMeta.destination} onChange={e=>setInquiryMeta(m=>({...m,destination:e.target.value}))}/></div>
            <div><label className="form-label">ETA</label><input type="date" className="form-input" value={inquiryMeta.eta} onChange={e=>setInquiryMeta(m=>({...m,eta:e.target.value}))}/></div>
            <div><label className="form-label">ETD</label><input type="date" className="form-input" value={inquiryMeta.etd} onChange={e=>setInquiryMeta(m=>({...m,etd:e.target.value}))}/></div>
            <div><label className="form-label">Vessel Name</label><input className="form-input" placeholder="e.g., MV Ocean Star" value={inquiryMeta.vesselName} onChange={e=>setInquiryMeta(m=>({...m,vesselName:e.target.value}))}/></div>
          </div>
        </div>

        {/* Results */}
        {!hasSearched ? (
          <div className="glass-card empty-state" style={{ padding:'4rem 2rem', textAlign:'center' }}>
            <span style={{ fontSize:'3.5rem', display:'block', marginBottom:'1rem', animation:'float 4s ease-in-out infinite' }}>⚓</span>
            <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.3rem', fontWeight:'600', marginBottom:'0.5rem' }}>Search the Global Parts Database</h3>
            <p style={{ color:'var(--text-muted)', maxWidth:400, margin:'0 auto' }}>Use the search bar or apply filters to find the marine spare parts you need.</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="glass-card empty-state" style={{ padding:'3rem', textAlign:'center' }}>
            <span className="empty-state-icon">🌊</span>
            <p style={{ color:'var(--text-secondary)' }}>No products found. Try broadening your search.</p>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ padding:'1.25rem', overflowX:'auto' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.95rem', marginBottom:'1rem' }}>
                Found <strong style={{ color:'var(--accent-primary)' }}>{displayedProducts.length}</strong> result{displayedProducts.length!==1?'s':''}
              </p>
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize:'0.9rem', minWidth:900 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border-color)' }}>
                    {['Equipment','Manufacturer','Model','Year','Part Name','Part #','Location','Qty','Service','Action'].map(h => (
                      <th key={h} style={{ padding:'0.75rem', fontWeight:'600', fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map(p => {
                    const sending = sendingIds.has(p.id);
                    return (
                      <tr key={p.id} style={{ borderBottom:'1px solid var(--border-color)', transition:'background 0.15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'0.75rem' }}>{p.category||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.brand||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.model_number||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.manufactured_at||'-'}</td>
                        <td style={{ padding:'0.75rem', fontWeight:'500' }}>{p.product_name||'-'}</td>
                        <td style={{ padding:'0.75rem', fontFamily:'monospace', color:'var(--text-secondary)' }}>{p.part_number||'-'}</td>
                        <td style={{ padding:'0.75rem' }}>{p.location||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--accent-primary)', fontWeight:'bold' }}>{p.quantity||'-'}</td>
                        <td style={{ padding:'0.75rem' }}>{p.service_type || 'Supply'}</td>
                        <td style={{ padding:'0.75rem' }}>
                          <button className="btn btn-primary" disabled={sending}
                            style={{ padding:'0.4rem 0.8rem', fontSize:'0.85rem', display:'inline-flex', alignItems:'center', gap:'0.4rem', minWidth:130, opacity:sending?0.7:1, cursor:sending?'not-allowed':'pointer' }}
                            onClick={() => openComposeModal(p)}>
                            {sending ? (<><span className="spinner" style={{ width:14, height:14, borderWidth:2 }}/> Sending...</>) : (<>✉️ Send Inquiry</>)}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ═══ FILTER MODAL ═══ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s' }}
             onClick={() => setShowModal(false)}>
          <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', boxShadow:'0 25px 60px rgba(0,0,0,0.2)', width:560, maxWidth:'94vw', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', animation:'scaleIn 0.25s' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.2rem', fontWeight:'700', margin:0 }}>Advanced Filters</h3>
                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', margin:'0.15rem 0 0' }}>Narrow results by equipment specs & availability</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'var(--text-muted)', padding:'0.25rem' }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex:1, padding:'1.5rem', overflowY:'auto' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'1.75rem' }}>
                
                {/* Equipment / Category */}
                <div>
                  <SectionTitle icon="🔩" label="Equipment / Category" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search equipment..." value={equipmentSearch}
                      onChange={e => setEquipmentSearch(e.target.value)}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', maxHeight:'180px', overflowY:'auto', paddingRight:'0.5rem' }}>
                    {filteredEquipmentOpts.map(o => <Checkbox key={o} label={o} checked={filters.equipment.includes(o)} onChange={() => toggleCheckbox('equipment',o)} />)}
                    {filteredEquipmentOpts.length===0 && (
                      <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', gridColumn:'1/-1', margin:0 }}>
                        {equipmentSearch.trim() ? "No categories found matching your search." : "Type to search categories..."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Manufacturer / Brand */}
                <div>
                  <SectionTitle icon="🏭" label="Manufacturer / Brand" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search brands..." value={manufacturerSearch}
                      onChange={e => setManufacturerSearch(e.target.value)}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', maxHeight:'180px', overflowY:'auto', paddingRight:'0.5rem' }}>
                    {filteredManufacturerOpts.map(o => <Checkbox key={o} label={o} checked={filters.manufacturer.includes(o)} onChange={() => toggleCheckbox('manufacturer',o)} />)}
                    {filteredManufacturerOpts.length===0 && (
                      <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', gridColumn:'1/-1', margin:0 }}>
                        {manufacturerSearch.trim() ? "No brands found matching your search." : "Type to search brands..."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Model Number */}
                <div>
                  <SectionTitle icon="🔎" label="Model Number" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search model number..." value={filters.modelNumber}
                      onChange={e => setFilters(f=>({...f, modelNumber:e.target.value}))}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                </div>

                {/* Stock Location */}
                <div>
                  <SectionTitle icon="📍" label="Stock Location" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search locations..." value={locationSearch}
                      onChange={e => setLocationSearch(e.target.value)}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', maxHeight:'120px', overflowY:'auto', paddingRight:'0.5rem' }}>
                    {filteredLocationOpts.map(o => <Checkbox key={o} label={o} checked={filters.stockLocation.includes(o)} onChange={() => toggleCheckbox('stockLocation',o)} />)}
                    {filteredLocationOpts.length===0 && (
                      <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', gridColumn:'1/-1', margin:0 }}>
                        {locationSearch.trim() ? "No locations found matching your search." : "Type to search locations..."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Minimum Quantity */}
                <div>
                  <SectionTitle icon="📦" label={`Minimum Quantity: ${filters.minQty}`} />
                  <div style={{ padding:'0 0.25rem' }}>
                    <input type="range" min="1" max="100" value={filters.minQty}
                      onChange={e => setFilters(f=>({...f, minQty:Number(e.target.value)}))}
                      style={{ width:'100%', accentColor:'var(--accent-primary)', height:6, cursor:'pointer' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>
                      <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
                    </div>
                  </div>
                </div>

                {/* Service Type */}
                <div>
                  <SectionTitle icon="🛠️" label="Service Type" />
                  <select className="form-input" value={filters.serviceType} onChange={e => setFilters(f => ({...f, serviceType: e.target.value}))}>
                    <option value="">Any</option>
                    <option value="Supply">Supply</option>
                    <option value="Supply and Service">Supply and Service</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <button className="btn btn-secondary" onClick={clearAll} style={{ fontSize:'0.85rem' }}>🧹 Clear All</button>
              <button className="btn btn-primary" onClick={() => { setShowModal(false); setHasSearched(true); toast.success(`${activeFilterCount} filter(s) applied.`); }}
                style={{ padding:'0.7rem 1.8rem' }}>
                Apply Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMAIL COMPOSER MODAL ═══ */}
      {showComposeModal && selectedProduct && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s' }}
             onClick={() => setShowComposeModal(false)}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px 12px 0 0', 
            boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1)', 
            width: 600, 
            maxWidth: '94vw', 
            height: '500px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            fontFamily: 'Arial, sans-serif',
            color: '#1f1f1f',
            border: '1px solid #ccc',
          }} onClick={e => e.stopPropagation()}>

            {/* Header: light gray/blueish background, "New Message" on left, controls on right */}
            <div style={{ 
              background: '#f2f6fc', 
              padding: '10px 16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              userSelect: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#1f1f1f' }}>New Message</span>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{ cursor: 'pointer', fontSize: '16px', color: '#5f6368' }}>−</span>
                <span style={{ cursor: 'pointer', fontSize: '14px', color: '#5f6368' }}>⤢</span>
                <span onClick={() => setShowComposeModal(false)} style={{ cursor: 'pointer', fontSize: '16px', color: '#5f6368', fontWeight: 'bold' }}>✕</span>
              </div>
            </div>

            {/* Form Fields container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#fff' }}>
              
              {/* To field row */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 16px', 
                borderBottom: '1px solid #f2f2f2',
                position: 'relative'
              }}>
                <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>To</span>
                <input 
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: '14px', 
                    color: '#202124',
                    background: 'transparent'
                  }} 
                  value={`${selectedProduct.company_name} <${selectedProduct.provider_email}>`} 
                  disabled 
                />
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#5f6368', userSelect: 'none' }}>
                  {!showCc && (
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                      onClick={() => setShowCc(true)}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Cc
                    </span>
                  )}
                  {!showBcc && (
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                      onClick={() => setShowBcc(true)}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Bcc
                    </span>
                  )}
                </div>
              </div>

              {/* CC field row */}
              {showCc && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f2f2f2'
                }}>
                  <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>Cc</span>
                  <input 
                    style={{ 
                      flex: 1, 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '14px', 
                      color: '#202124'
                    }} 
                    placeholder="Cc email address"
                    value={emailData.cc} 
                    onChange={e => setEmailData(prev => ({ ...prev, cc: e.target.value }))} 
                  />
                  <span 
                    onClick={() => setShowCc(false)} 
                    style={{ cursor: 'pointer', color: '#bdc1c6', fontSize: '14px', marginLeft: '6px' }}
                  >
                    ✕
                  </span>
                </div>
              )}

              {/* BCC field row */}
              {showBcc && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f2f2f2'
                }}>
                  <span style={{ width: '40px', color: '#5f6368', fontSize: '14px' }}>Bcc</span>
                  <input 
                    style={{ 
                      flex: 1, 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '14px', 
                      color: '#202124'
                    }} 
                    placeholder="Bcc email address"
                    value={emailData.bcc} 
                    onChange={e => setEmailData(prev => ({ ...prev, bcc: e.target.value }))} 
                  />
                  <span 
                    onClick={() => setShowBcc(false)} 
                    style={{ cursor: 'pointer', color: '#bdc1c6', fontSize: '14px', marginLeft: '6px' }}
                  >
                    ✕
                  </span>
                </div>
              )}

              {/* Subject field row */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 16px', 
                borderBottom: '1px solid #f2f2f2'
              }}>
                <input 
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    fontSize: '14px', 
                    color: '#202124'
                  }} 
                  placeholder="Subject"
                  value={emailData.subject} 
                  onChange={e => setEmailData(prev => ({ ...prev, subject: e.target.value }))} 
                />
              </div>

              {/* Message Body Field */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
                <textarea 
                  style={{ 
                    width: '100%', 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    resize: 'none',
                    fontSize: '14px', 
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: '1.5',
                    color: '#202124',
                    background: '#fff'
                  }} 
                  placeholder="Say something..."
                  value={emailData.body} 
                  onChange={e => setEmailData(prev => ({ ...prev, body: e.target.value }))} 
                />
              </div>

            </div>

            {/* Footer Toolbar: Send button & icons */}
            <div style={{ 
              padding: '12px 16px', 
              background: '#fff', 
              borderTop: '1px solid #f2f2f2',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Blue pill Send button with dropdown */}
                <div style={{ display: 'flex', borderRadius: '24px', overflow: 'hidden', background: '#0b57d0' }}>
                  <button 
                    onClick={handleSendInquiry}
                    style={{ 
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#084bb8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Send
                  </button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
                  <button 
                    style={{ 
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#084bb8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '10px' }}>▼</span>
                  </button>
                </div>

                {/* Toolbar icons matching Gmail */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#444746' }}>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Formatting options">Aa</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Attach files">📎</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert link">🔗</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert emoji">😊</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert files using Drive">📁</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert photo">📷</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Toggle confidential mode">🔒</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="Insert signature">✍️</span>
                  <span style={{ cursor: 'pointer', padding: '6px', borderRadius: '50%', fontSize: '16px', userSelect: 'none' }} title="More options">⋮</span>
                </div>
              </div>

              {/* Trash icon */}
              <button 
                onClick={() => setShowComposeModal(false)}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#444746',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f2f2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                title="Discard draft"
              >
                🗑️
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}

// ── Small helper components ──
function Chip({ label, onRemove }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.3rem 0.7rem', background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:'var(--radius-full)', fontSize:'0.78rem', color:'var(--accent-primary)', fontWeight:'500' }}>
      {label}
      <span onClick={onRemove} style={{ cursor:'pointer', fontWeight:'700', marginLeft:'0.15rem', opacity:0.6 }}>×</span>
    </span>
  );
}

function SectionTitle({ icon, label }) {
  return (
    <h4 style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--text-primary)', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.4rem', textTransform:'uppercase', letterSpacing:'0.5px' }}>
      <span>{icon}</span> {label}
    </h4>
  );
}
