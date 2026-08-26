import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

const getEmailClientUrl = (clientType, to, subject, body, cc, bcc) => {
  const encTo = encodeURIComponent(to);
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  const ccParam = cc ? encodeURIComponent(cc) : '';
  const bccParam = bcc ? encodeURIComponent(bcc) : '';

  switch (clientType) {
    case 'gmail': {
      let url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}`;
      if (ccParam) url += `&cc=${ccParam}`;
      if (bccParam) url += `&bcc=${bccParam}`;
      return url;
    }
    case 'yahoo': {
      let url = `https://compose.mail.yahoo.com/?to=${encTo}&subj=${encSubject}&body=${encBody}`;
      if (ccParam) url += `&cc=${ccParam}`;
      if (bccParam) url += `&bcc=${bccParam}`;
      return url;
    }
    case 'outlook': {
      let url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encTo}&subject=${encSubject}&body=${encBody}`;
      if (ccParam) url += `&cc=${ccParam}`;
      if (bccParam) url += `&bcc=${bccParam}`;
      return url;
    }
    case 'mailto':
    default: {
      let url = `mailto:${to}?subject=${encSubject}&body=${encBody}`;
      if (ccParam) url += `&cc=${ccParam}`;
      if (bccParam) url += `&bcc=${bccParam}`;
      return url;
    }
  }
};

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
  const [showSendDropdown, setShowSendDropdown] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  // ── Multi-Ship & Specifications state ──
  const [showShipsModal, setShowShipsModal] = useState(false);
  const [ships, setShips] = useState([]);
  const [selectedShipId, setSelectedShipId] = useState(null); // null = "All Equipment"
  const [savedSpecs, setSavedSpecs] = useState([]);
  const [specsFilterActive, setSpecsFilterActive] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [specsSaving, setSpecsSaving] = useState(false);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [newShipName, setNewShipName] = useState('');
  const [newShipImo, setNewShipImo] = useState('');
  const [newShipType, setNewShipType] = useState('');
  const [creatingShip, setCreatingShip] = useState(false);
  const [expandedShipId, setExpandedShipId] = useState(null);
  const [showShipDropdown, setShowShipDropdown] = useState(false);

  const [filters, setFilters] = useState({
    equipment: [], manufacturer: [], modelNumber: '', partNumber: '',
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

  // Load buyer's ships on mount
  const loadShips = useCallback(async () => {
    if (!token) { setShipsLoading(false); return; }
    try {
      const r = await axios.get(`${API}/buyer/ships`, { headers: { Authorization: `Bearer ${token}` } });
      setShips(r.data || []);
    } catch (e) { console.error('Failed to load ships:', e); }
    finally { setShipsLoading(false); }
  }, [token]);

  useEffect(() => { loadShips(); }, [loadShips]);

  // Load specs when a ship is selected
  useEffect(() => {
    if (!token || !selectedShipId) {
      setSavedSpecs([]);
      setSpecsFilterActive(false);
      return;
    }
    (async () => {
      try {
        const r = await axios.get(`${API}/buyer/ships/${selectedShipId}/specifications`, { headers: { Authorization: `Bearer ${token}` } });
        const specs = r.data || [];
        setSavedSpecs(specs);
        setSpecsFilterActive(specs.length > 0);
      } catch (e) { console.error('Failed to load ship specs:', e); setSavedSpecs([]); setSpecsFilterActive(false); }
    })();
  }, [token, selectedShipId]);

  // ── CSV parsing handler ──
  const handleCsvFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file.');
      return;
    }
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields.map(h => h.trim().toLowerCase());
        if (!headers.includes('equipment')) {
          toast.error('CSV must contain an "Equipment" column.');
          setCsvPreview([]);
          setCsvFileName('');
          return;
        }
        // Map rows to normalized objects
        const rows = results.data.map(row => {
          const normalized = {};
          Object.keys(row).forEach(k => { normalized[k.trim().toLowerCase()] = row[k]; });
          return {
            equipment: (normalized['equipment'] || '').trim(),
            manufacturer: (normalized['manufacturer'] || '').trim(),
            model: (normalized['model'] || '').trim(),
          };
        }).filter(r => r.equipment); // skip rows with empty equipment
        if (rows.length === 0) {
          toast.error('No valid rows found in the CSV.');
          setCsvPreview([]);
          setCsvFileName('');
          return;
        }
        setCsvPreview(rows);
        toast.success(`Parsed ${rows.length} specification(s) from ${file.name}`);
      },
      error: (err) => {
        toast.error('Failed to parse CSV: ' + err.message);
        setCsvPreview([]);
        setCsvFileName('');
      }
    });
  }, []);

  // ── Save specifications for a specific ship ──
  const handleSaveSpecs = async (shipId) => {
    if (csvPreview.length === 0) { toast.error('No specifications to save.'); return; }
    setSpecsSaving(true);
    try {
      await axios.post(`${API}/buyer/ships/${shipId}/specifications`, { specifications: csvPreview }, { headers: { Authorization: `Bearer ${token}` } });
      setCsvPreview([]);
      setCsvFileName('');
      toast.success(`✅ ${csvPreview.length} specification(s) saved!`);
      // Refresh ships list to get updated spec_count
      await loadShips();
      // If this is the selected ship, reload its specs
      if (selectedShipId === shipId) {
        const r = await axios.get(`${API}/buyer/ships/${shipId}/specifications`, { headers: { Authorization: `Bearer ${token}` } });
        setSavedSpecs(r.data || []);
        setSpecsFilterActive(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save specifications.');
    } finally { setSpecsSaving(false); }
  };

  // ── Create a new ship ──
  const handleCreateShip = async () => {
    if (!newShipName.trim()) { toast.error('Ship name is required.'); return; }
    setCreatingShip(true);
    try {
      const r = await axios.post(`${API}/buyer/ships`, {
        ship_name: newShipName.trim(),
        imo_number: newShipImo.trim() || null,
        ship_type: newShipType.trim() || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewShipName('');
      setNewShipImo('');
      setNewShipType('');
      toast.success(`🚢 Ship "${r.data.ship_name}" created!`);
      await loadShips();
      setExpandedShipId(r.data.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create ship.');
    } finally { setCreatingShip(false); }
  };

  // ── Delete a ship ──
  const handleDeleteShip = async (shipId, shipName) => {
    try {
      await axios.delete(`${API}/buyer/ships/${shipId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Ship "${shipName}" deleted.`);
      if (selectedShipId === shipId) {
        setSelectedShipId(null);
        setSavedSpecs([]);
        setSpecsFilterActive(false);
      }
      await loadShips();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete ship.');
    }
  };

  // ── Select a ship (or "All Equipment") ──
  const handleSelectShip = (shipId) => {
    setSelectedShipId(shipId);
    setShowShipDropdown(false);
    setShowRelated(false);
    if (!shipId) {
      setSavedSpecs([]);
      setSpecsFilterActive(false);
    }
  };

  const selectedShip = ships.find(s => s.id === selectedShipId) || null;

  // Dynamic options from DB
  const equipmentOpts = useMemo(() => [...new Set(allProducts.map(p => p.category).filter(Boolean))], [allProducts]);
  const manufacturerOpts = useMemo(() => [...new Set(allProducts.map(p => p.brand).filter(Boolean))], [allProducts]);
  const locationOpts = useMemo(() => [...new Set(allProducts.map(p => p.location).filter(Boolean))], [allProducts]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.equipment.length) c++;
    if (filters.manufacturer.length) c++;
    if (filters.modelNumber) c++;
    if (filters.partNumber) c++;
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
      // ── My Specifications filter ──
      if (specsFilterActive && savedSpecs.length > 0) {
        const matchesAnySpec = savedSpecs.some(spec => {
          if (spec.equipment && !fuzzyMatch(p.category, spec.equipment)) return false;
          if (spec.manufacturer && !fuzzyMatch(p.brand, spec.manufacturer)) return false;
          if (spec.model && !fuzzyMatch(p.model_number, spec.model)) return false;
          return true;
        });
        if (!matchesAnySpec) return false;
      }

      if (q && !(fuzzyMatch(p.product_name, q) || fuzzyMatch(p.part_number, q) || fuzzyMatch(p.category, q) || fuzzyMatch(p.brand, q))) return false;
      if (filters.equipment.length && !filters.equipment.includes(p.category)) return false;
      if (filters.manufacturer.length && !filters.manufacturer.includes(p.brand)) return false;
      if (filters.modelNumber && !fuzzyMatch(p.model_number, filters.modelNumber)) return false;
      if (filters.partNumber && !fuzzyMatch(p.part_number, filters.partNumber)) return false;
      if (filters.stockLocation.length && !filters.stockLocation.includes(p.location)) return false;
      if (filters.minQty > 1 && Number(p.quantity) < filters.minQty) return false;
      const sType = p.service_type || 'Supply';
      if (filters.serviceType && sType !== filters.serviceType) return false;
      return true;
    });
  }, [hasSearched, searchQuery, filters, allProducts, specsFilterActive, savedSpecs]);

  // ── Related products: same equipment type but different manufacturer/model ──
  const relatedProducts = useMemo(() => {
    if (!hasSearched || !specsFilterActive || !savedSpecs.length || displayedProducts.length > 0) return [];
    const q = searchQuery.trim().toLowerCase();

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
        return levenshtein(sw, pw) <= (pw.length <= 4 ? 1 : 2);
      }));
    };

    // Match products that share the same equipment/category as any spec, but may differ in manufacturer/model
    return allProducts.filter(p => {
      const matchesEquipmentOnly = savedSpecs.some(spec => {
        if (!spec.equipment) return false;
        return fuzzyMatch(p.category, spec.equipment);
      });
      if (!matchesEquipmentOnly) return false;

      // Apply text search if present
      if (q && !(fuzzyMatch(p.product_name, q) || fuzzyMatch(p.part_number, q) || fuzzyMatch(p.category, q) || fuzzyMatch(p.brand, q))) return false;
      // Apply other filters
      if (filters.equipment.length && !filters.equipment.includes(p.category)) return false;
      if (filters.stockLocation.length && !filters.stockLocation.includes(p.location)) return false;
      if (filters.minQty > 1 && Number(p.quantity) < filters.minQty) return false;
      const sType = p.service_type || 'Supply';
      if (filters.serviceType && sType !== filters.serviceType) return false;
      return true;
    });
  }, [hasSearched, searchQuery, filters, allProducts, specsFilterActive, savedSpecs, displayedProducts]);

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

  const logSearchedProducts = async (products, query) => {
    if (!products || products.length === 0 || !token) return;
    try {
      const product_ids = products.slice(0, 15).map(p => p.id);
      await axios.post(`${API}/buyer/searches`, {
        product_ids,
        search_query: query || ''
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      // Non-critical background logging
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() && activeFilterCount === 0) { toast.error('Enter a search term or apply filters.'); return; }
    setHasSearched(true);
    setShowRelated(false);
    setTimeout(() => {
      logSearchedProducts(displayedProducts, searchQuery.trim());
    }, 100);
  };

  const toggleCheckbox = (field, value) => {
    setFilters(f => ({
      ...f, [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value]
    }));
  };

  const clearAll = () => { setFilters({ equipment:[], manufacturer:[], modelNumber:'', partNumber:'', stockLocation:[], minQty:1, serviceType:'' }); };

  const handleSendInquiry = async (clientType) => {
    if (!selectedProduct) return;
    if (!inquiryMeta.destination.trim()) { toast.error('Please enter Destination Port in the inquiry details section.'); return; }
    if (!inquiryMeta.eta.trim()) { toast.error('Please select ETA in the inquiry details section (compulsory).'); return; }
    if (!inquiryMeta.vesselName.trim()) { toast.error('Please enter Vessel Name in the inquiry details section (compulsory).'); return; }
    if (sendingIds.has(selectedProduct.id)) return;
    setSendingIds(prev => new Set(prev).add(selectedProduct.id));
    try {
      await axios.post(`${API}/buyer/inquiries`, {
        selections: [{ provider_id: selectedProduct.provider_id, product_id: selectedProduct.id }],
        destination_location: inquiryMeta.destination.trim(),
        delivery_requirements: {
          eta: inquiryMeta.eta.trim(),
          etd: inquiryMeta.etd ? inquiryMeta.etd.trim() : null,
          vessel_name: inquiryMeta.vesselName.trim()
        },
        cc: emailData.cc ? emailData.cc.trim() : null,
        bcc: emailData.bcc ? emailData.bcc.trim() : null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      const to = selectedProduct.provider_email || '';
      const cc = emailData.cc ? emailData.cc.trim() : '';
      const bcc = emailData.bcc ? emailData.bcc.trim() : '';
      
      const emailUrl = getEmailClientUrl(clientType, to, emailData.subject, emailData.body, cc, bcc);
      
      if (clientType === 'mailto') {
        window.location.href = emailUrl;
      } else {
        window.open(emailUrl, '_blank', 'noreferrer');
      }

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
      toast.error('Please enter Destination Port in the inquiry details section.');
      return;
    }
    if (!inquiryMeta.eta.trim()) {
      toast.error('Please select ETA in the inquiry details section (compulsory).');
      return;
    }
    if (!inquiryMeta.vesselName.trim()) {
      toast.error('Please enter Vessel Name in the inquiry details section (compulsory).');
      return;
    }
    setSelectedProduct(product);
    const subject = `🚢 Purchase Inquiry: ${product.product_name} — Vortex Marketplace`;
    const body = `Dear ${product.company_name} Team,\n\nI am interested in purchasing the following listed product:\n\n- Product: ${product.product_name}\n- Brand: ${product.brand || 'N/A'}\n- Model: ${product.model_number || 'N/A'}\n- Part Number: ${product.part_number || 'N/A'}\n\nDelivery Details:\n- Destination Port: ${inquiryMeta.destination.trim()}\n- ETA: ${inquiryMeta.eta.trim()}\n- ETD: ${inquiryMeta.etd ? inquiryMeta.etd.trim() : 'N/A'}\n- Vessel Name: ${inquiryMeta.vesselName.trim()}\n- Minimum Quantity Required: ${filters.minQty}\n\nPlease let me know if you can fulfill this request and provide a price quote.\n\nBest regards,\n${user?.username || 'Buyer'}`;
    
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
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={() => setShowShipsModal(true)} className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', background: ships.length > 0 ? 'linear-gradient(135deg, #059669, #10b981)' : undefined, position:'relative' }}>
              <span>🚢</span> My Ships
              {ships.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,0.3)', fontSize:'0.7rem', fontWeight:'700' }}>{ships.length}</span>}
            </button>
            <a href="/buyer/inquiries" className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem' }}><span>📨</span> My recents</a>
          </div>
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
            {ships.length > 0 && (
              <div style={{ position:'relative' }}>
                <button type="button" onClick={() => setShowShipDropdown(v => !v)}
                  style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.8rem 1.4rem', background: selectedShipId ? 'rgba(5,150,105,0.08)' : 'var(--bg-surface)', border:`2px solid ${selectedShipId ? '#059669' : 'var(--border-color)'}`, borderRadius:'var(--radius-full)', color: selectedShipId ? '#059669' : 'var(--text-secondary)', fontWeight:'600', fontSize:'0.9rem', cursor:'pointer', transition:'all 0.2s', fontFamily:"'Inter',sans-serif" }}>
                  <span>🚢</span>
                  {selectedShip ? selectedShip.ship_name : 'All Equipment'}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition:'transform 0.2s', transform: showShipDropdown ? 'rotate(180deg)' : 'none' }}><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {showShipDropdown && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:100, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:220, overflow:'hidden', animation:'fadeIn 0.15s' }}>
                    <button onClick={() => handleSelectShip(null)}
                      style={{ display:'flex', alignItems:'center', gap:'0.5rem', width:'100%', padding:'0.7rem 1rem', background: !selectedShipId ? 'rgba(37,99,235,0.06)' : 'transparent', border:'none', textAlign:'left', cursor:'pointer', fontSize:'0.88rem', fontWeight: !selectedShipId ? '600' : '400', color: !selectedShipId ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily:"'Inter',sans-serif", transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = !selectedShipId ? 'rgba(37,99,235,0.06)' : 'var(--bg-surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = !selectedShipId ? 'rgba(37,99,235,0.06)' : 'transparent'}>
                      🌍 All Equipment
                      {!selectedShipId && <span style={{ marginLeft:'auto', color:'var(--accent-primary)' }}>✓</span>}
                    </button>
                    <div style={{ height:1, background:'var(--border-color)' }}></div>
                    {ships.map(ship => (
                      <button key={ship.id} onClick={() => handleSelectShip(ship.id)}
                        style={{ display:'flex', alignItems:'center', gap:'0.5rem', width:'100%', padding:'0.7rem 1rem', background: selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'transparent', border:'none', textAlign:'left', cursor:'pointer', fontSize:'0.88rem', fontWeight: selectedShipId === ship.id ? '600' : '400', color: selectedShipId === ship.id ? '#059669' : 'var(--text-primary)', fontFamily:"'Inter',sans-serif", transition:'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'transparent'}>
                        🚢 {ship.ship_name}
                        <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--text-muted)' }}>{ship.spec_count} specs</span>
                        {selectedShipId === ship.id && <span style={{ color:'#059669' }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ padding:'0.8rem 1.8rem', borderRadius:'var(--radius-full)' }}>Search</button>
          </form>

          {activeFilterCount > 0 && (
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.75rem' }}>
              {filters.equipment.map(v => <Chip key={`eq-${v}`} label={`Equipment: ${v}`} onRemove={() => toggleCheckbox('equipment',v)} />)}
              {filters.manufacturer.map(v => <Chip key={`mf-${v}`} label={`Brand: ${v}`} onRemove={() => toggleCheckbox('manufacturer',v)} />)}
              {filters.modelNumber && <Chip label={`Model: ${filters.modelNumber}`} onRemove={() => setFilters(f=>({...f,modelNumber:''}))} />}
              {filters.partNumber && <Chip label={`Part #: ${filters.partNumber}`} onRemove={() => setFilters(f=>({...f,partNumber:''}))} />}
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
            📋 Inquiry Details <span style={{ fontSize:'0.75rem', fontWeight:'400', color:'var(--text-muted)' }}>(Destination, ETA & Vessel Name are compulsory)</span>
          </h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'0.75rem' }}>
            <div>
              <label className="form-label">Destination Port <span style={{ color:'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="e.g., Singapore" value={inquiryMeta.destination} onChange={e=>setInquiryMeta(m=>({...m,destination:e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">ETA <span style={{ color:'var(--danger)' }}>*</span></label>
              <input type="date" className="form-input" value={inquiryMeta.eta} onChange={e=>setInquiryMeta(m=>({...m,eta:e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">ETD <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:'normal' }}>(Optional)</span></label>
              <input type="date" className="form-input" value={inquiryMeta.etd} onChange={e=>setInquiryMeta(m=>({...m,etd:e.target.value}))}/>
            </div>
            <div>
              <label className="form-label">Vessel Name <span style={{ color:'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="e.g., MV Ocean Star" value={inquiryMeta.vesselName} onChange={e=>setInquiryMeta(m=>({...m,vesselName:e.target.value}))} required />
            </div>
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
          <>
            <div className="glass-card empty-state" style={{ padding:'3rem', textAlign:'center' }}>
              {specsFilterActive && savedSpecs.length > 0 && relatedProducts.length > 0 ? (
                <>
                  <span style={{ fontSize:'3rem', display:'block', marginBottom:'1rem' }}>🔍</span>
                  <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.2rem', fontWeight:'700', color:'var(--text-primary)', marginBottom:'0.5rem' }}>
                    Product Unavailable for Your Specifications
                  </h3>
                  <p style={{ color:'var(--text-secondary)', maxWidth:480, margin:'0 auto 1.25rem', lineHeight:'1.5' }}>
                    We couldn't find an exact match for your ship's equipment specifications (manufacturer & model).
                    However, we found <strong style={{ color:'var(--accent-primary)' }}>{relatedProducts.length}</strong> related product{relatedProducts.length !== 1 ? 's' : ''} with the same equipment type but from different manufacturers or models.
                  </p>
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'1.25rem' }}>
                    Would you like to see alternative products?
                  </p>
                  {!showRelated ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowRelated(true)}
                      style={{
                        padding:'0.85rem 2rem',
                        fontSize:'0.95rem',
                        borderRadius:'var(--radius-full)',
                        background:'linear-gradient(135deg, #059669, #10b981)',
                        display:'inline-flex',
                        alignItems:'center',
                        gap:'0.6rem',
                        animation:'pulse 2s ease-in-out infinite'
                      }}
                    >
                      ✅ Yes, Show Related Products
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowRelated(false)}
                      style={{ padding:'0.7rem 1.5rem', fontSize:'0.9rem', borderRadius:'var(--radius-full)' }}
                    >
                      ✕ Hide Related Products
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="empty-state-icon">🌊</span>
                  <p style={{ color:'var(--text-secondary)' }}>No products found. Try broadening your search.</p>
                </>
              )}
            </div>

            {/* Related Products Table */}
            {showRelated && relatedProducts.length > 0 && (
              <div className="glass-card" style={{ padding:'1.25rem', overflowX:'auto', marginTop:'1rem' }}>
                <p style={{ color:'var(--text-secondary)', fontSize:'0.95rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg, #f59e0b, #f97316)', fontSize:'0.75rem' }}>⚡</span>
                  <span>Showing <strong style={{ color:'var(--accent-primary)' }}>{relatedProducts.length}</strong> related product{relatedProducts.length !== 1 ? 's' : ''} <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>(same equipment type, different manufacturer/model)</span></span>
                </p>
                <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize:'0.9rem', minWidth:900 }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid var(--border-color)' }}>
                      {['Equipment','Manufacturer','Model','Year','Part Name','Part #','Location','Qty','Service','Payment','Last Updated','Action'].map(h => (
                        <th key={h} style={{ padding:'0.75rem', fontWeight:'600', fontSize:'0.78rem', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relatedProducts.map(p => {
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
                          <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.payment_mode || 'pre-payment/credit'}</td>
                          <td style={{ padding:'0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}
                          </td>
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
            )}
          </>
        ) : (
          <>
            <div className="glass-card" style={{ padding:'1.25rem', overflowX:'auto' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.95rem', marginBottom:'1rem' }}>
                Found <strong style={{ color:'var(--accent-primary)' }}>{displayedProducts.length}</strong> result{displayedProducts.length!==1?'s':''}
              </p>
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize:'0.9rem', minWidth:900 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border-color)' }}>
                    {['Equipment','Manufacturer','Model','Year','Part Name','Part #','Location','Qty','Service','Payment','Last Updated','Action'].map(h => (
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
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.payment_mode || 'pre-payment/credit'}</td>
                        <td style={{ padding:'0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}
                        </td>
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

                {/* Part Number */}
                <div>
                  <SectionTitle icon="🏷️" label="Part Number" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search part number..." value={filters.partNumber}
                      onChange={e => setFilters(f=>({...f, partNumber:e.target.value}))}
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
              <button className="btn btn-primary" onClick={() => { 
                setShowModal(false); 
                setHasSearched(true); 
                setTimeout(() => logSearchedProducts(displayedProducts, searchQuery.trim()), 100);
                toast.success(`${activeFilterCount} filter(s) applied.`); 
              }}
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
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', borderRadius: '24px', overflow: 'hidden', background: '#0b57d0' }}>
                    <button 
                      onClick={() => setShowSendDropdown(!showSendDropdown)}
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
                      Send Options
                    </button>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
                    <button 
                      onClick={() => setShowSendDropdown(!showSendDropdown)}
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

                  {showSendDropdown && (
                    <>
                      <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 1005 }} 
                        onClick={() => setShowSendDropdown(false)} 
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '8px',
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        width: '240px',
                        zIndex: 1010,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}>
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                          Select Email Client
                        </div>
                        {[
                          { id: 'gmail', name: 'Google Mail (Gmail)', icon: '🔴', desc: 'Open in Gmail web' },
                          { id: 'yahoo', name: 'Yahoo Mail', icon: '🟣', desc: 'Open in Yahoo Mail web' },
                          { id: 'outlook', name: 'Outlook Web', icon: '🔵', desc: 'Open in Outlook web' },
                          { id: 'mailto', name: 'Default Mail App', icon: '✉️', desc: 'Use system default client' }
                        ].map(client => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setShowSendDropdown(false);
                              handleSendInquiry(client.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              textAlign: 'left',
                              padding: '10px 16px',
                              fontSize: '14px',
                              color: '#333',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f2f2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <span style={{ fontSize: '16px' }}>{client.icon}</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '500' }}>{client.name}</span>
                              <span style={{ fontSize: '11px', color: '#888' }}>{client.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
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

      {/* ═══ SHIPS MANAGEMENT MODAL ═══ */}
      {showShipsModal && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s' }}
             onClick={() => { setShowShipsModal(false); setCsvPreview([]); setCsvFileName(''); setExpandedShipId(null); }}>
          <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', boxShadow:'0 25px 60px rgba(0,0,0,0.2)', width:720, maxWidth:'94vw', maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', animation:'scaleIn 0.25s' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg, rgba(5,150,105,0.05), rgba(16,185,129,0.05))' }}>
              <div>
                <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.2rem', fontWeight:'700', margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>🚢 Manage My Ships</h3>
                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', margin:'0.15rem 0 0' }}>Add ships and upload their equipment specifications.</p>
              </div>
              <button onClick={() => { setShowShipsModal(false); setCsvPreview([]); setCsvFileName(''); setExpandedShipId(null); }} style={{ background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'var(--text-muted)', padding:'0.25rem' }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex:1, padding:'1.5rem', overflowY:'auto', background:'var(--bg-body)' }}>

              {/* Add New Ship Form */}
              <div className="glass-card" style={{ padding:'1.25rem', marginBottom:'1.5rem' }}>
                <h4 style={{ fontSize:'0.9rem', fontWeight:'600', marginBottom:'1rem', color:'var(--text-primary)' }}>➕ Add a New Ship</h4>
                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Name *</label>
                    <input className="form-input" placeholder="e.g. MV Ocean Star" value={newShipName} onChange={e=>setNewShipName(e.target.value)} />
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>IMO Number</label>
                    <input className="form-input" placeholder="Optional" value={newShipImo} onChange={e=>setNewShipImo(e.target.value)} />
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Type</label>
                    <input className="form-input" placeholder="Optional" value={newShipType} onChange={e=>setNewShipType(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={handleCreateShip} disabled={creatingShip || !newShipName.trim()} style={{ height:'42px', padding:'0 1.25rem' }}>
                    {creatingShip ? 'Creating...' : 'Create Ship'}
                  </button>
                </div>
              </div>

              {/* Ships List */}
              <h4 style={{ fontSize:'1rem', fontWeight:'600', marginBottom:'1rem', color:'var(--text-primary)' }}>Your Ships ({ships.length})</h4>
              
              {ships.length === 0 ? (
                <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--text-muted)', background:'var(--bg-surface)', borderRadius:'var(--radius-md)', border:'1px dashed var(--border-color)' }}>
                  <span style={{ fontSize:'2.5rem', display:'block', marginBottom:'0.75rem' }}>🚢</span>
                  <p style={{ fontWeight:'500', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>No ships added yet</p>
                  <p style={{ fontSize:'0.85rem' }}>Create a ship above to start managing its specifications.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  {ships.map(ship => (
                    <div key={ship.id} style={{ background:'var(--bg-surface)', border:`1px solid ${expandedShipId === ship.id ? '#059669' : 'var(--border-color)'}`, borderRadius:'var(--radius-md)', overflow:'hidden', transition:'all 0.2s' }}>
                      
                      {/* Ship Header (Click to expand) */}
                      <div 
                        onClick={() => {
                          setExpandedShipId(expandedShipId === ship.id ? null : ship.id);
                          setCsvPreview([]);
                          setCsvFileName('');
                        }}
                        style={{ padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', background: expandedShipId === ship.id ? 'rgba(5,150,105,0.03)' : 'transparent' }}
                      >
                        <div>
                          <h5 style={{ margin:0, fontSize:'1.05rem', fontWeight:'600', display:'flex', alignItems:'center', gap:'0.5rem', color: expandedShipId === ship.id ? '#059669' : 'var(--text-primary)' }}>
                            🚢 {ship.ship_name}
                          </h5>
                          <div style={{ display:'flex', gap:'1rem', marginTop:'0.25rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                            {ship.imo_number && <span>IMO: {ship.imo_number}</span>}
                            {ship.ship_type && <span>Type: {ship.ship_type}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.25rem 0.6rem', borderRadius:'1rem', fontSize:'0.75rem', fontWeight:'600', background: ship.spec_count > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(100,100,100,0.1)', color: ship.spec_count > 0 ? '#059669' : 'var(--text-secondary)' }}>
                            {ship.spec_count} Specifications
                          </span>
                          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ transition:'transform 0.2s', transform: expandedShipId === ship.id ? 'rotate(180deg)' : 'none', color:'var(--text-muted)' }}><path d="M1.5 1.5L6 6L10.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>

                      {/* Ship Details (Expanded) */}
                      {expandedShipId === ship.id && (
                        <div style={{ padding:'1.25rem', borderTop:'1px solid var(--border-color)', background:'var(--bg-card)', animation:'fadeIn 0.2s' }} onClick={e => e.stopPropagation()}>
                          
                          {/* Upload Area for this ship */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; handleCsvFile(file); }}
                            style={{
                              border: `2px dashed ${dragOver ? '#059669' : csvFileName ? '#059669' : 'var(--border-color)'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '1.5rem',
                              textAlign: 'center',
                              background: dragOver ? 'rgba(5,150,105,0.06)' : csvFileName ? 'rgba(5,150,105,0.03)' : 'var(--bg-surface)',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              marginBottom: '1.25rem'
                            }}
                            onClick={() => document.getElementById(`specs-csv-input-${ship.id}`).click()}
                          >
                            <input
                              id={`specs-csv-input-${ship.id}`}
                              type="file"
                              accept=".csv"
                              style={{ display: 'none' }}
                              onChange={(e) => { handleCsvFile(e.target.files[0]); e.target.value = ''; }}
                            />
                            <span style={{ fontSize:'2rem', display:'block', marginBottom:'0.5rem' }}>{csvFileName ? '✅' : '📄'}</span>
                            {csvFileName ? (
                              <>
                                <p style={{ fontWeight:'600', color:'#059669', marginBottom:'0.25rem', fontSize:'0.9rem' }}>{csvFileName}</p>
                                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{csvPreview.length} row(s) parsed. Click to change file.</p>
                              </>
                            ) : (
                              <>
                                <p style={{ fontWeight:'600', color:'var(--text-primary)', marginBottom:'0.25rem', fontSize:'0.9rem' }}>Upload Specs CSV for {ship.ship_name}</p>
                                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>Required columns: <strong>Equipment</strong>, <strong>Manufacturer</strong>, <strong>Model</strong></p>
                                {ship.spec_count > 0 && <p style={{ fontSize:'0.75rem', color:'var(--danger)', marginTop:'0.5rem', fontWeight:'500' }}>⚠️ Warning: Uploading a new CSV will replace existing specifications.</p>}
                              </>
                            )}
                          </div>

                          {/* CSV Preview Table */}
                          {csvPreview.length > 0 && (
                            <div style={{ marginBottom:'1.25rem' }}>
                              <h4 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'0.9rem', fontWeight:'600', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                👁️ Preview ({csvPreview.length} rows)
                              </h4>
                              <div style={{ maxHeight:'180px', overflowY:'auto', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                                  <thead>
                                    <tr style={{ background:'var(--bg-surface)', borderBottom:'2px solid var(--border-color)', position:'sticky', top:0 }}>
                                      <th style={{ padding:'0.5rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>#</th>
                                      <th style={{ padding:'0.5rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Equipment</th>
                                      <th style={{ padding:'0.5rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Manufacturer</th>
                                      <th style={{ padding:'0.5rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Model</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {csvPreview.map((row, i) => (
                                      <tr key={i} style={{ borderBottom:'1px solid var(--border-color)' }}>
                                        <td style={{ padding:'0.4rem 0.5rem', color:'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ padding:'0.4rem 0.5rem', fontWeight:'500' }}>{row.equipment}</td>
                                        <td style={{ padding:'0.4rem 0.5rem', color:'var(--text-secondary)' }}>{row.manufacturer || '—'}</td>
                                        <td style={{ padding:'0.4rem 0.5rem', color:'var(--text-secondary)' }}>{row.model || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ marginTop:'0.75rem', display:'flex', gap:'0.75rem' }}>
                                <button className="btn btn-primary" onClick={() => handleSaveSpecs(ship.id)} disabled={specsSaving}
                                  style={{ padding:'0.6rem 1.5rem', background:'linear-gradient(135deg, #059669, #10b981)', fontSize:'0.85rem' }}>
                                  {specsSaving ? 'Saving...' : '💾 Save to Ship'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => { setCsvPreview([]); setCsvFileName(''); }}
                                  style={{ padding:'0.6rem 1.2rem', fontSize:'0.85rem' }}>Cancel</button>
                              </div>
                            </div>
                          )}

                          <div style={{ display:'flex', justifyContent:'flex-end', borderTop:'1px solid var(--border-color)', paddingTop:'1rem', marginTop:'1rem' }}>
                            <button className="btn btn-secondary" 
                              onClick={() => { if(window.confirm(`Are you sure you want to delete "${ship.ship_name}" and all its specifications?`)) handleDeleteShip(ship.id, ship.ship_name); }}
                              style={{ padding:'0.5rem 1rem', fontSize:'0.8rem', color:'var(--danger)', borderColor:'var(--danger)' }}>
                              🗑️ Delete Ship
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-color)', display:'flex', justifyContent:'flex-end', background:'var(--bg-card)' }}>
              <button className="btn btn-secondary" onClick={() => { setShowShipsModal(false); setCsvPreview([]); setCsvFileName(''); setExpandedShipId(null); }} style={{ padding:'0.7rem 1.5rem' }}>Close</button>
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
