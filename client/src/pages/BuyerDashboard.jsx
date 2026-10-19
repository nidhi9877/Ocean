import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MarineNewsTicker from '../components/MarineNewsTicker';

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

const cleanStr = (s) => (s || '').toLowerCase().replace(/[-_/\\.,:;()]+/g, ' ').replace(/\s+/g, ' ').trim();

const levenshtein = (a, b) => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) m[i][j] = m[i - 1][j - 1];
      else m[i][j] = Math.min(m[i - 1][j - 1] + 1, Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1));
    }
  }
  return m[b.length][a.length];
};

const termMatchesText = (term, text) => {
  if (!term) return true;
  if (!text) return false;
  const t = String(term).toLowerCase().trim();
  const s = String(text).toLowerCase().trim();
  if (!t || !s) return false;
  if (s.includes(t)) return true;

  const tClean = cleanStr(t);
  const sClean = cleanStr(s);
  if (!tClean || !sClean) return false;
  if (sClean.includes(tClean)) return true;

  const words = sClean.split(' ').filter(Boolean);
  for (const word of words) {
    if (word === tClean || word.startsWith(tClean)) return true;
    // For short terms (<= 4 chars like "ais", "gps", "man", "c32"), never allow typo edit distance
    if (tClean.length <= 4) continue;
    // For longer terms (>= 5 chars), allow 1 typo edit distance
    if (Math.abs(word.length - tClean.length) <= 1 && levenshtein(word, tClean) <= 1) {
      return true;
    }
  }
  return false;
};

const matchesSearch = (query, ...textSources) => {
  if (!query || !String(query).trim()) return true;
  const rawQuery = String(query).toLowerCase().trim();
  const terms = rawQuery.split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const combined = textSources.filter(Boolean).map(s => String(s)).join(' ');
  return terms.every(term => termMatchesText(term, combined));
};

// Seeded PRNG and shuffle helpers to randomize equipment & seller assignment on search
const createPrng = (seed) => {
  let s = Math.abs(Number(seed) || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const seededShuffle = (array, seed) => {
  if (!array || array.length <= 1) return array ? [...array] : [];
  const arr = [...array];
  const rand = createPrng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const [allProducts, setAllProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(true);
  const [searchSeed, setSearchSeed] = useState(() => Math.floor(Math.random() * 1000000000));
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
  const [hasManuallyClearedShip, setHasManuallyClearedShip] = useState(false);
  const [savedSpecs, setSavedSpecs] = useState([]);
  const [specsFilterActive, setSpecsFilterActive] = useState(false);
  // ── Compatible Options Mode: set when buyer clicks "Explore Compatible Options" ──
  const [compatibleOptionsMode, setCompatibleOptionsMode] = useState(false);
  const [compatibleOptionsSpec, setCompatibleOptionsSpec] = useState(null); // { equipment, manufacturer, model }
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [specsSaving, setSpecsSaving] = useState(false);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [newShipName, setNewShipName] = useState('');
  const [newShipImo, setNewShipImo] = useState('');
  const [newShipType, setNewShipType] = useState('');
  const [creatingShip, setCreatingShip] = useState(false);
  const [expandedShipId, setExpandedShipId] = useState(null);
  const [showShipDropdown, setShowShipDropdown] = useState(false);

  // Ship editing state
  const [editingShipId, setEditingShipId] = useState(null);
  const [editShipForm, setEditShipForm] = useState({ ship_name: '', imo_number: '', ship_type: '' });
  const [savingShip, setSavingShip] = useState(false);

  // Specifications management state (manual add / update / delete)
  const [expandedShipSpecs, setExpandedShipSpecs] = useState([]);
  const [loadingShipSpecs, setLoadingShipSpecs] = useState(false);
  const [shipSpecsTab, setShipSpecsTab] = useState('specs'); // 'specs' | 'upload'
  const [newManualSpec, setNewManualSpec] = useState({ equipment: '', manufacturer: '', model: '' });
  const [addingManualSpec, setAddingManualSpec] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState(null);
  const [editSpecForm, setEditSpecForm] = useState({ equipment: '', manufacturer: '', model: '' });
  const [savingSpecId, setSavingSpecId] = useState(null);
  const [csvUploadMode, setCsvUploadMode] = useState('replace'); // 'replace' | 'append'
  const [specSearchQuery, setSpecSearchQuery] = useState('');

  // ── Ship Market Export State ──
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModalShip, setExportModalShip] = useState(null);
  const [exportPreviewData, setExportPreviewData] = useState(null);
  const [loadingExportPreview, setLoadingExportPreview] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportBreakdownTab, setExportBreakdownTab] = useState('available'); // 'available' | 'unavailable'

  const [filters, setFilters] = useState({
    equipment: [], manufacturer: [], modelNumber: '', partNumber: '',
    stockLocation: [], minQty: 1, serviceType: '', partCategory: '', condition: '',
  });

  // Automatically update search seed on query or filter changes to randomize items and seller IDs
  useEffect(() => {
    setSearchSeed(Math.floor(Math.random() * 1000000000));
  }, [searchQuery, filters]);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/seller/products`);
        setAllProducts(r.data.products || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Load buyer's ships on mount
  const loadShips = useCallback(async () => {
    if (!token) { setShipsLoading(false); return; }
    try {
      const r = await axios.get(`${API}/buyer/ships`, { headers: { Authorization: `Bearer ${token}` } });
      const loadedShips = r.data || [];
      setShips(loadedShips);
      // Auto-select ship with specifications so compatible options and yellow/red rows are immediately active
      setSelectedShipId(current => {
        if (current && loadedShips.some(s => s.id === current)) return current;
        if (!hasManuallyClearedShip && loadedShips.length > 0) {
          const withSpecs = loadedShips.find(s => (s.spec_count || 0) > 0);
          return withSpecs ? withSpecs.id : loadedShips[0].id;
        }
        return current;
      });
    } catch (e) { console.error('Failed to load ships:', e); }
    finally { setShipsLoading(false); }
  }, [token, hasManuallyClearedShip]);

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
        if (specs.length > 0) {
          setHasSearched(true);
        }
      } catch (e) { console.error('Failed to load ship specs:', e); setSavedSpecs([]); setSpecsFilterActive(false); }
    })();
  }, [token, selectedShipId]);

  // ── Specifications file parsing handler (supports standard .xlsx, .xls, and .csv) ──
  const handleSpecsFile = useCallback((file) => {
    if (!file) return;
    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload a standard Excel (.xlsx, .xls) file.');
      return;
    }
    setCsvFileName(name);

    const processRows = (rawRows, sourceName) => {
      if (!rawRows || !rawRows.length) {
        toast.error('No rows found in the uploaded file.');
        setCsvPreview([]);
        setCsvFileName('');
        return;
      }
      // Check headers
      const firstRow = rawRows[0] || {};
      const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase());
      if (!keys.includes('equipment')) {
        toast.error('File must contain an "Equipment" column.');
        setCsvPreview([]);
        setCsvFileName('');
        return;
      }
      const normalizedRows = rawRows.map(row => {
        const norm = {};
        Object.keys(row).forEach(k => { norm[k.trim().toLowerCase()] = row[k]; });
        return {
          equipment: String(norm['equipment'] || '').trim(),
          manufacturer: String(norm['manufacturer'] || '').trim(),
          model: String(norm['model'] || '').trim(),
        };
      }).filter(r => r.equipment);

      if (normalizedRows.length === 0) {
        toast.error('No valid equipment rows found in the file.');
        setCsvPreview([]);
        setCsvFileName('');
        return;
      }
      setCsvPreview(normalizedRows);
      toast.success(`✅ Parsed ${normalizedRows.length} specification(s) from ${sourceName}`);
    };

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data, name),
        error: (err) => {
          toast.error('Failed to parse file: ' + err.message);
          setCsvPreview([]);
          setCsvFileName('');
        }
      });
    } else {
      // Excel .xlsx / .xls parsing via XLSX
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processRows(json, name);
        } catch (err) {
          toast.error('Failed to parse Excel file: ' + err.message);
          setCsvPreview([]);
          setCsvFileName('');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  // Backward compatibility alias
  const handleCsvFile = handleSpecsFile;

  // ── Download Sample Template in standard .xlsx format ──
  const downloadSampleExcel = () => {
    const sampleRows = [
      { 'Equipment': 'Main Engine', 'Manufacturer': 'MAN B&W', 'Model': '6S50MC-C' },
      { 'Equipment': 'Auxiliary Engine', 'Manufacturer': 'Yanmar', 'Model': '6EY18ALW' },
      { 'Equipment': 'Turbocharger', 'Manufacturer': 'ABB', 'Model': 'TPL77-B' },
      { 'Equipment': 'Oily Water Separator', 'Manufacturer': 'Alfa Laval', 'Model': 'PureBilge' },
      { 'Equipment': 'Purifier', 'Manufacturer': 'Alfa Laval', 'Model': 'S 821' },
      { 'Equipment': 'Radar', 'Manufacturer': 'Furuno', 'Model': 'FAR-2117' },
      { 'Equipment': 'ECDIS', 'Manufacturer': 'Transas', 'Model': 'Navi-Sailor 4000' },
      { 'Equipment': 'Boiler', 'Manufacturer': 'Aalborg', 'Model': 'Mission OS' }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ship Specifications');
    XLSX.writeFile(wb, 'sample_ship_specifications.xlsx');
    toast.success('Sample specifications template (.xlsx) downloaded!');
  };

  const downloadSampleCsv = downloadSampleExcel;

  // ── Load specs for an expanded ship ──
  const loadShipSpecs = useCallback(async (shipId) => {
    if (!shipId || !token) return;
    setLoadingShipSpecs(true);
    try {
      const r = await axios.get(`${API}/buyer/ships/${shipId}/specifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpandedShipSpecs(r.data || []);
    } catch (e) {
      console.error('Failed to load ship specs:', e);
      toast.error('Failed to load specifications for this ship.');
    } finally {
      setLoadingShipSpecs(false);
    }
  }, [token]);

  // ── Expand/Collapse a ship in modal ──
  const handleExpandShip = (shipId) => {
    if (expandedShipId === shipId) {
      setExpandedShipId(null);
      setExpandedShipSpecs([]);
      setEditingShipId(null);
      setEditingSpecId(null);
      setCsvPreview([]);
      setCsvFileName('');
    } else {
      setExpandedShipId(shipId);
      setEditingShipId(null);
      setEditingSpecId(null);
      setCsvPreview([]);
      setCsvFileName('');
      setNewManualSpec({ equipment: '', manufacturer: '', model: '' });
      setSpecSearchQuery('');
      setShipSpecsTab('specs');
      loadShipSpecs(shipId);
    }
  };

  // ── Edit ship details ──
  const handleStartEditShip = (ship) => {
    setEditingShipId(ship.id);
    setEditShipForm({
      ship_name: ship.ship_name || '',
      imo_number: ship.imo_number || '',
      ship_type: ship.ship_type || ''
    });
  };

  const handleUpdateShip = async (shipId) => {
    if (!editShipForm.ship_name.trim()) {
      toast.error('Ship name is required.');
      return;
    }
    setSavingShip(true);
    try {
      const r = await axios.put(`${API}/buyer/ships/${shipId}`, {
        ship_name: editShipForm.ship_name.trim(),
        imo_number: editShipForm.imo_number.trim() || null,
        ship_type: editShipForm.ship_type.trim() || null
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShips(prev => prev.map(s => s.id === shipId ? { ...s, ...r.data } : s));
      setEditingShipId(null);
      toast.success(`Ship "${r.data.ship_name}" updated!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update ship.');
    } finally {
      setSavingShip(false);
    }
  };

  // ── Add manual specification ──
  const handleAddManualSpec = async (shipId) => {
    if (!newManualSpec.equipment.trim()) {
      toast.error('Equipment name is required.');
      return;
    }
    setAddingManualSpec(true);
    try {
      const r = await axios.post(`${API}/buyer/ships/${shipId}/specifications/item`, {
        equipment: newManualSpec.equipment.trim(),
        manufacturer: newManualSpec.manufacturer.trim() || null,
        model: newManualSpec.model.trim() || null
      }, { headers: { Authorization: `Bearer ${token}` } });

      const updated = [...expandedShipSpecs, r.data];
      setExpandedShipSpecs(updated);
      setNewManualSpec({ equipment: '', manufacturer: '', model: '' });

      // Update spec_count in ships list
      setShips(prev => prev.map(s => s.id === shipId ? { ...s, spec_count: (s.spec_count || 0) + 1 } : s));

      // If active ship in dashboard, update savedSpecs
      if (selectedShipId === shipId) {
        setSavedSpecs(updated);
        setSpecsFilterActive(true);
      }

      toast.success('Specification added successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add specification.');
    } finally {
      setAddingManualSpec(false);
    }
  };

  // ── Edit / Update manual specification ──
  const handleStartEditSpec = (spec) => {
    setEditingSpecId(spec.id);
    setEditSpecForm({
      equipment: spec.equipment || '',
      manufacturer: spec.manufacturer || '',
      model: spec.model || ''
    });
  };

  const handleUpdateManualSpec = async (shipId, specId) => {
    if (!editSpecForm.equipment.trim()) {
      toast.error('Equipment name is required.');
      return;
    }
    setSavingSpecId(specId);
    try {
      const r = await axios.put(`${API}/buyer/ships/${shipId}/specifications/${specId}`, {
        equipment: editSpecForm.equipment.trim(),
        manufacturer: editSpecForm.manufacturer.trim() || null,
        model: editSpecForm.model.trim() || null
      }, { headers: { Authorization: `Bearer ${token}` } });

      const updated = expandedShipSpecs.map(s => s.id === specId ? r.data : s);
      setExpandedShipSpecs(updated);
      setEditingSpecId(null);

      // If active ship in dashboard, update savedSpecs
      if (selectedShipId === shipId) {
        setSavedSpecs(updated);
      }

      toast.success('Specification updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update specification.');
    } finally {
      setSavingSpecId(null);
    }
  };

  // ── Delete manual specification ──
  const handleDeleteManualSpec = async (shipId, specId) => {
    try {
      await axios.delete(`${API}/buyer/ships/${shipId}/specifications/${specId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updated = expandedShipSpecs.filter(s => s.id !== specId);
      setExpandedShipSpecs(updated);

      // Update spec_count in ships list
      setShips(prev => prev.map(s => s.id === shipId ? { ...s, spec_count: Math.max(0, (s.spec_count || 1) - 1) } : s));

      // If active ship in dashboard, update savedSpecs
      if (selectedShipId === shipId) {
        setSavedSpecs(updated);
        setSpecsFilterActive(updated.length > 0);
      }

      toast.success('Specification deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete specification.');
    }
  };

  // ── Save specifications for a specific ship (CSV upload) ──
  const handleSaveSpecs = async (shipId) => {
    if (csvPreview.length === 0) { toast.error('No specifications to save.'); return; }
    setSpecsSaving(true);
    try {
      await axios.post(`${API}/buyer/ships/${shipId}/specifications`, {
        specifications: csvPreview,
        mode: csvUploadMode
      }, { headers: { Authorization: `Bearer ${token}` } });

      setCsvPreview([]);
      setCsvFileName('');
      toast.success(`✅ ${csvPreview.length} specification(s) saved!`);

      // Refresh specifications and ships
      await loadShipSpecs(shipId);
      await loadShips();

      // If this is the selected ship, reload its specs
      if (selectedShipId === shipId) {
        const r = await axios.get(`${API}/buyer/ships/${shipId}/specifications`, { headers: { Authorization: `Bearer ${token}` } });
        setSavedSpecs(r.data || []);
        setSpecsFilterActive(true);
      }
      setShipSpecsTab('specs');
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
      handleExpandShip(r.data.id);
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        toast.error(err.response?.data?.error || 'Failed to create ship.');
      }
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
      if (expandedShipId === shipId) {
        setExpandedShipId(null);
        setExpandedShipSpecs([]);
      }
      await loadShips();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete ship.');
    }
  };

  // ── Close Ships Modal ──
  const handleCloseShipsModal = () => {
    setShowShipsModal(false);
    setCsvPreview([]);
    setCsvFileName('');
    setExpandedShipId(null);
    setExpandedShipSpecs([]);
    setEditingShipId(null);
    setEditingSpecId(null);
    setNewManualSpec({ equipment: '', manufacturer: '', model: '' });
    setSpecSearchQuery('');
  };

  // ── Select a ship (or "All Equipment") ──
  const handleSelectShip = async (shipId) => {
    setSelectedShipId(shipId);
    setShowShipDropdown(false);
    setSearchQuery('');
    if (!shipId) {
      setHasManuallyClearedShip(true);
      setSavedSpecs([]);
      setSpecsFilterActive(false);
    } else {
      setHasManuallyClearedShip(false);
      setSpecsFilterActive(true);
      setHasSearched(true);
      if (token) {
        try {
          const r = await axios.get(`${API}/buyer/ships/${shipId}/specifications`, { headers: { Authorization: `Bearer ${token}` } });
          const specs = r.data || [];
          setSavedSpecs(specs);
          setSpecsFilterActive(specs.length > 0);
        } catch (e) {
          console.error('Failed to load ship specs on select:', e);
        }
      }
    }
  };

  // ── Download Equipment Availability Breakdown Excel (2 sheets: Available Items & Not Available Items) ──
  const handleDownloadShipData = async (ship) => {
    if (!ship || !ship.id) {
      toast.error('Please choose a valid ship to download.');
      return;
    }
    setExportingCsv(true);
    const toastId = toast.loading(`Preparing Equipment Availability Breakdown Excel for ${ship.ship_name}...`);
    try {
      const res = await axios.get(`${API}/buyer/ships/${ship.id}/market-availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data || {};
      const equipmentList = data.equipment || [];
      const sanitizedName = (ship.ship_name || 'Ship').replace(/[^a-zA-Z0-9_-]/g, '_');

      const getUniqueBrands = (items) => {
        const seen = new Set();
        const list = [];
        (items || []).forEach(p => {
          const brand = (p.brand || '').trim();
          if (brand && !seen.has(brand.toLowerCase())) {
            seen.add(brand.toLowerCase());
            list.push(brand);
          }
        });
        return list;
      };

      const getUniquePartNames = (items) => {
        const seen = new Set();
        const list = [];
        (items || []).forEach(p => {
          const name = p.product_name?.trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            list.push(name);
          }
        });
        return list;
      };

      // Sheet 1: Available Items (unchanged, exactly as shown in screenshot)
      const availableList = equipmentList.filter(eq => eq.compatibility_status === 'compatible');
      const availableRows = availableList.map((eq, i) => {
        const uniqueParts = getUniquePartNames(eq.products);
        return {
          '#': i + 1,
          'Equipment': eq.equipment,
          'Manufacturer': eq.manufacturer || '—',
          'Number of Sellers': eq.available_listings_count || 0,
          'Total Spares Qty': eq.total_available_quantity || 0,
          'Available Parts Preview': uniqueParts.length > 0 ? uniqueParts.join(', ') : '—'
        };
      });

      // Sheet 2: Not Available Items (Compatible Options)
      const unavailableList = equipmentList.filter(eq => eq.compatibility_status !== 'compatible');
      const unavailableRows = unavailableList.map((eq, i) => {
        const brands = getUniqueBrands(eq.equipment_only_products);
        return {
          '#': i + 1,
          'Equipment': eq.equipment,
          'Number of Sellers': eq.equipment_only_listings_count || 0,
          'Available Quantity/Set': eq.equipment_only_total_quantity || 0,
          'Available Brand': brands.length > 0 ? brands.join(', ') : '—'
        };
      });

      const wb = XLSX.utils.book_new();

      const wsAvailable = XLSX.utils.json_to_sheet(
        availableRows.length > 0
          ? availableRows
          : [{ '#': 1, 'Equipment': 'None', 'Manufacturer': '—', 'Number of Sellers': 0, 'Total Spares Qty': 0, 'Available Parts Preview': '—' }]
      );
      XLSX.utils.book_append_sheet(wb, wsAvailable, 'Available Items');

      const wsUnavailable = XLSX.utils.json_to_sheet(
        unavailableRows.length > 0
          ? unavailableRows
          : [{ '#': 1, 'Equipment': 'None', 'Number of Sellers': 0, 'Available Quantity/Set': 0, 'Available Brand': '—' }]
      );
      XLSX.utils.book_append_sheet(wb, wsUnavailable, 'Not Available Items');

      XLSX.writeFile(wb, `${sanitizedName}_equipment_availability_breakdown.xlsx`);

      toast.success(`✅ Downloaded ${sanitizedName}_equipment_availability_breakdown.xlsx!`, { id: toastId });
    } catch (err) {
      console.error('Failed to download ship availability breakdown:', err);
      toast.error('Failed to download data. Please try again.', { id: toastId });
    } finally {
      setExportingCsv(false);
    }
  };

  // Backward compatibility alias
  const handleExportShipCsv = handleDownloadShipData;

  // ── Open Export Preview & Options Modal ──
  const handleOpenExportModal = async (ship) => {
    if (!ship || !ship.id) return;
    setExportModalShip(ship);
    setShowExportModal(true);
    setLoadingExportPreview(true);
    setExportPreviewData(null);
    setExportBreakdownTab('available');
    try {
      const res = await axios.get(`${API}/buyer/ships/${ship.id}/market-availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExportPreviewData(res.data);
    } catch (err) {
      console.error('Failed to load export preview data:', err);
      toast.error('Failed to load market preview for this ship.');
    } finally {
      setLoadingExportPreview(false);
    }
  };

  // Filter specifications by query in modal
  const filteredShipSpecs = useMemo(() => {
    if (!specSearchQuery.trim()) return expandedShipSpecs;
    const q = specSearchQuery.toLowerCase();
    return expandedShipSpecs.filter(s =>
      (s.equipment || '').toLowerCase().includes(q) ||
      (s.manufacturer || '').toLowerCase().includes(q) ||
      (s.model || '').toLowerCase().includes(q)
    );
  }, [expandedShipSpecs, specSearchQuery]);

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
    if (filters.partCategory) c++;
    if (filters.condition) c++;
    return c;
  }, [filters]);

  // ── Per-spec classification: classifies each spec as compatible/incompatible/not_available ──
  const specClassification = useMemo(() => {
    if (!specsFilterActive || !savedSpecs.length) return [];

    const matchesEquipment = (p, spec) => {
      if (!spec.equipment) return true;
      return matchesSearch(spec.equipment, p.category, p.product_name);
    };
    const matchesSpecFull = (p, spec) => {
      if (!matchesEquipment(p, spec)) return false;
      if (spec.manufacturer && spec.manufacturer.trim()) {
        if (!matchesSearch(spec.manufacturer, p.brand, p.product_name)) return false;
      }
      if (spec.model && spec.model.trim()) {
        if (!matchesSearch(spec.model, p.model_number, p.product_name)) return false;
      }
      return true;
    };

    return savedSpecs.map(spec => {
      const compatibleProducts = allProducts.filter(p => matchesSpecFull(p, spec));
      // Tier 2: equipment matches but different mfr/model — ONLY 'Complete Set' items qualify as compatible alternatives
      const equipmentOnlyProducts = allProducts.filter(p => {
        if (!matchesEquipment(p, spec)) return false;
        if (compatibleProducts.some(cp => cp.id === p.id)) return false;
        // Only Complete Set items can appear as compatible alternatives
        const cat = (p.part_category || '').trim().toLowerCase();
        if (cat !== 'complete set') return false;
        return true;
      });

      let status;
      let reason;
      if (compatibleProducts.length > 0) {
        status = 'compatible';
        reason = 'Compatible match found';
      } else if (equipmentOnlyProducts.length > 0) {
        status = 'incompatible';
        reason = 'Available in market but with different manufacturer/model';
      } else {
        status = 'not_available';
        reason = 'Not available in the market from any manufacturer or model';
      }

      return {
        spec,
        status,
        reason,
        compatibleCount: compatibleProducts.length,
        incompatibleCount: equipmentOnlyProducts.length,
      };
    });
  }, [specsFilterActive, savedSpecs, allProducts]);

  const displayedProducts = useMemo(() => {
    if (!hasSearched) return [];
    const q = searchQuery.trim();

    const matchesEquipment = (p, spec) => {
      if (!spec.equipment) return true;
      return matchesSearch(spec.equipment, p.category, p.product_name);
    };
    const matchesSpecFull = (p, spec) => {
      if (!matchesEquipment(p, spec)) return false;
      if (spec.manufacturer && spec.manufacturer.trim()) {
        if (!matchesSearch(spec.manufacturer, p.brand, p.product_name)) return false;
      }
      if (spec.model && spec.model.trim()) {
        if (!matchesSearch(spec.model, p.model_number, p.product_name)) return false;
      }
      return true;
    };

    const filtered = allProducts.filter(p => {
      // ── My Specifications filter: only show fully compatible products ──
      if (specsFilterActive && savedSpecs.length > 0) {
        const matchesAnySpecFull = savedSpecs.some(spec => matchesSpecFull(p, spec));
        if (!matchesAnySpecFull) return false;
      }

      // ── Compatible Options Mode ──
      // Rule A: Same manufacturer, different model → any category (Spare Part or Complete Set) is fine
      // Rule B: Different manufacturer → only 'Complete Set' qualifies
      if (compatibleOptionsMode && compatibleOptionsSpec) {
        const isSameMfr = compatibleOptionsSpec.manufacturer
          ? matchesSearch(compatibleOptionsSpec.manufacturer, p.brand)
          : false;

        if (isSameMfr) {
          // Same manufacturer — must have a different model to be a genuine alternative
          if (compatibleOptionsSpec.model && p.model_number) {
            // If the model matches the original spec exactly, it's not an alternative
            if (matchesSearch(compatibleOptionsSpec.model, p.model_number)) return false;
          }
          // (if no model on spec or product, still show it — it's from the same brand)
        } else {
          // Different manufacturer — only Complete Sets qualify as compatible alternatives
          const cat = (p.part_category || '').trim().toLowerCase();
          if (cat !== 'complete set') return false;
        }
      }

      if (q && !matchesSearch(q, p.product_name, p.category, p.part_category, p.brand, p.model_number, p.part_number, p.location, p.warranty, p.service_type, p.equipment_condition)) {
        return false;
      }
      if (filters.equipment.length && !filters.equipment.includes(p.category)) return false;
      if (filters.manufacturer.length && !filters.manufacturer.includes(p.brand)) return false;
      if (filters.modelNumber && !matchesSearch(filters.modelNumber, p.model_number)) return false;
      if (filters.partNumber && !matchesSearch(filters.partNumber, p.part_number)) return false;
      if (filters.stockLocation.length && !filters.stockLocation.includes(p.location)) return false;
      if (filters.minQty > 1 && Number(p.quantity) < filters.minQty) return false;
      const sType = p.service_type || 'Supply';
      if (filters.serviceType && sType !== filters.serviceType) return false;
      if (filters.partCategory) {
        const pCat = (p.part_category || '').trim().toLowerCase();
        if (pCat !== filters.partCategory.toLowerCase()) return false;
      }
      if (filters.condition) {
        const pCond = (p.equipment_condition || 'New').trim().toLowerCase();
        if (pCond !== filters.condition.toLowerCase()) return false;
      }
      return true;
    });

    // When searching, shuffle the matching equipments so no seller has a predictable order or fixed spot
    const isSearching = Boolean(q || activeFilterCount > 0);
    if (isSearching && filtered.length > 1) {
      return seededShuffle(filtered, searchSeed);
    }
    return filtered;
  }, [hasSearched, searchQuery, filters, allProducts, specsFilterActive, savedSpecs, activeFilterCount, searchSeed, compatibleOptionsMode, compatibleOptionsSpec]);

  const filteredEquipmentOpts = useMemo(() => {
    if (!equipmentSearch.trim()) {
      return equipmentOpts.filter(o => filters.equipment.includes(o));
    }
    return equipmentOpts.filter(o => matchesSearch(equipmentSearch, o));
  }, [equipmentOpts, equipmentSearch, filters.equipment]);

  const filteredManufacturerOpts = useMemo(() => {
    if (!manufacturerSearch.trim()) {
      return manufacturerOpts.filter(o => filters.manufacturer.includes(o));
    }
    return manufacturerOpts.filter(o => matchesSearch(manufacturerSearch, o));
  }, [manufacturerOpts, manufacturerSearch, filters.manufacturer]);

  const filteredLocationOpts = useMemo(() => {
    if (!locationSearch.trim()) {
      return locationOpts.filter(o => filters.stockLocation.includes(o));
    }
    return locationOpts.filter(o => matchesSearch(locationSearch, o));
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
    if (!searchQuery.trim() && activeFilterCount === 0 && !selectedShipId) {
      toast.error('Enter a search term or apply filters.');
      return;
    }
    setSearchSeed(Math.floor(Math.random() * 1000000000));
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

  const clearAll = () => { setFilters({ equipment:[], manufacturer:[], modelNumber:'', partNumber:'', stockLocation:[], minQty:1, serviceType:'', partCategory:'', condition:'' }); };

  const handleSendInquiry = async (clientType) => {
    if (!selectedProduct) return;
    if (!inquiryMeta.destination.trim()) { toast.error('Please enter Destination Port in the inquiry details section.'); return; }
    if (!inquiryMeta.eta.trim()) { toast.error('Please select ETA in the inquiry details section (compulsory).'); return; }
    if (sendingIds.has(selectedProduct.id)) return;
    setSendingIds(prev => new Set(prev).add(selectedProduct.id));
    try {
      await axios.post(`${API}/buyer/inquiries`, {
        selections: [{ provider_id: selectedProduct.provider_id, product_id: selectedProduct.id }],
        destination_location: inquiryMeta.destination.trim(),
        delivery_requirements: {
          eta: inquiryMeta.eta.trim(),
          etd: inquiryMeta.etd ? inquiryMeta.etd.trim() : null,
          vessel_name: inquiryMeta.vesselName ? inquiryMeta.vesselName.trim() : null
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
    setSelectedProduct(product);
    const sellerName = product.provider_username || product.company_name || 'Seller';
    const productName = product.product_name || product.category || 'N/A';
    const subject = `🚢 Purchase Inquiry: ${productName} — MarineStockHub Marketplace`;
    const body = `Dear ${sellerName} Team,\n\nI am interested in purchasing the following listed product:\n\n- Product: ${productName}\n- Brand: ${product.brand || 'N/A'}\n- Model: ${product.model_number || 'N/A'}\n- Part Number: ${product.part_number || 'N/A'}\n\nDelivery Details:\n- Destination Port: ${inquiryMeta.destination.trim()}\n- ETA: ${inquiryMeta.eta.trim()}\n- ETD: ${inquiryMeta.etd ? inquiryMeta.etd.trim() : 'N/A'}\n- Vessel Name: ${inquiryMeta.vesselName ? inquiryMeta.vesselName.trim() : 'N/A'}\n- Minimum Quantity Required: ${filters.minQty}\n\nPlease let me know if you can fulfill this request and provide a price quote.\n\nBest regards,\n${user?.username || 'Buyer'}`;
    
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
        {/* Ocean & Marine News Ticker Banner */}
        <MarineNewsTicker />

        {/* Header */}
        <div className="dashboard-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <h1 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.8rem', fontWeight:'700' }}>Welcome, {user?.username} 👋</h1>
            <p style={{ color:'var(--text-secondary)', marginTop:'0.25rem' }}>Search marine spare parts and send inquiries directly to sellers.</p>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={() => setShowShipsModal(true)} className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', background: ships.length > 0 ? 'linear-gradient(135deg, #059669, #10b981)' : undefined, position:'relative' }}>
              <span>🚢</span> My Ships
              {ships.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,0.3)', fontSize:'0.7rem', fontWeight:'700' }}>{ships.length}</span>}
            </button>
            <a href="/buyer/inquiries" className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem' }}><span>📨</span> My recents</a>
          </div>
        </div>

        {/* Search Bar — Sticky & Static with zero hover jumping */}
        <div
          className="glass-card buyer-search-card"
          style={{
            padding: '1.25rem 2rem',
            marginBottom: '1.25rem',
            overflow: 'visible',
            position: 'sticky',
            top: '68px',
            zIndex: 80,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.06)'
          }}
        >
          <form onSubmit={handleSearch} style={{ display:'flex', gap:'0.75rem', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, minWidth:'280px' }}>
              <span style={{ position:'absolute', left:'1rem', top:'50%', transform:'translateY(-50%)', fontSize:'1.15rem', color:'var(--text-muted)', pointerEvents:'none' }}>🔍</span>
              <input
                style={{ width:'100%', padding:'0.9rem 2.8rem 0.9rem 3rem', background:'var(--bg-surface)', border:'2px solid var(--border-color)', borderRadius:'var(--radius-full)', color:'var(--text-primary)', fontFamily:"'Inter',sans-serif", fontSize:'0.95rem', outline:'none', transition:'all 0.2s' }}
                placeholder="Search by Part Name, Number, Equipment, or Manufacturer..."
                value={searchQuery}
                onChange={e => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  // Exit compatible-options mode whenever user manually types
                  if (compatibleOptionsMode) setCompatibleOptionsMode(false);
                  if (!val.trim() && selectedShipId && savedSpecs.length > 0 && !specsFilterActive) {
                    setSpecsFilterActive(true);
                  }
                }}
                onFocus={e => { e.target.style.borderColor='var(--accent-primary)'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor='var(--border-color)'; e.target.style.boxShadow='none'; }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCompatibleOptionsMode(false);
                    if (selectedShipId && savedSpecs.length > 0 && !specsFilterActive) {
                      setSpecsFilterActive(true);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px'
                  }}
                  title="Clear search"
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  ✕
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.8rem 1.4rem', background: activeFilterCount?'rgba(37,99,235,0.04)':'var(--bg-surface)', border:`2px solid ${activeFilterCount?'var(--accent-primary)':'var(--border-color)'}`, borderRadius:'var(--radius-full)', color: activeFilterCount?'var(--accent-primary)':'var(--text-secondary)', fontWeight:'600', fontSize:'0.9rem', cursor:'pointer', transition:'all 0.2s', fontFamily:"'Inter',sans-serif" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filters
              {activeFilterCount > 0 && <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, borderRadius:'50%', background:'var(--accent-gradient)', color:'white', fontSize:'0.7rem', fontWeight:'700' }}>{activeFilterCount}</span>}
            </button>
            {ships.length > 0 && (
              <div style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:'0.5rem' }}>
                <button type="button" onClick={() => setShowShipDropdown(v => !v)}
                  style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', padding:'0.8rem 1.4rem', background: selectedShipId ? 'rgba(5,150,105,0.08)' : 'var(--bg-surface)', border:`2px solid ${selectedShipId ? '#059669' : 'var(--border-color)'}`, borderRadius:'var(--radius-full)', color: selectedShipId ? '#059669' : 'var(--text-secondary)', fontWeight:'600', fontSize:'0.9rem', cursor:'pointer', transition:'all 0.2s', fontFamily:"'Inter',sans-serif" }}>
                  <span>🚢</span>
                  <span>Ship: <strong>{selectedShip ? selectedShip.ship_name : 'All Equipment'}</strong></span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition:'transform 0.2s', transform: showShipDropdown ? 'rotate(180deg)' : 'none' }}><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>

                {/* Direct Download Button right next to selector when a ship is chosen */}
                {selectedShip && (
                  <button
                    type="button"
                    onClick={() => handleDownloadShipData(selectedShip)}
                    disabled={exportingCsv}
                    className="btn btn-secondary"
                    style={{
                      display:'inline-flex',
                      alignItems:'center',
                      gap:'0.45rem',
                      padding:'0.8rem 1.3rem',
                      borderRadius:'var(--radius-full)',
                      color:'#059669',
                      borderColor:'rgba(5,150,105,0.4)',
                      background:'rgba(5,150,105,0.08)',
                      fontWeight:'600',
                      fontSize:'0.88rem',
                      cursor:'pointer',
                      transition:'all 0.2s',
                      fontFamily:"'Inter',sans-serif"
                    }}
                    title={`Download Equipment Availability Breakdown for ${selectedShip.ship_name} in Excel (.xlsx)`}
                  >
                    <span>📥</span>
                    <span>{exportingCsv ? 'Downloading...' : 'Download Breakdown (.xlsx)'}</span>
                  </button>
                )}

                {showShipDropdown && (
                  <>
                    <div style={{ position:'fixed', inset:0, zIndex:99 }} onClick={() => setShowShipDropdown(false)} />
                    <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:100, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', boxShadow:'0 12px 32px rgba(0,0,0,0.18)', minWidth:300, maxHeight:360, overflowY:'auto', animation:'fadeIn 0.15s' }}>
                      <div style={{ padding:'0.6rem 1rem', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', borderBottom:'1px solid var(--border-color)', background:'var(--bg-surface)' }}>
                        Select Ship to Filter Parts
                      </div>
                      <button onClick={() => handleSelectShip(null)}
                        style={{ display:'flex', alignItems:'center', gap:'0.5rem', width:'100%', padding:'0.75rem 1rem', background: !selectedShipId ? 'rgba(37,99,235,0.06)' : 'transparent', border:'none', textAlign:'left', cursor:'pointer', fontSize:'0.88rem', fontWeight: !selectedShipId ? '600' : '400', color: !selectedShipId ? 'var(--accent-primary)' : 'var(--text-primary)', fontFamily:"'Inter',sans-serif", transition:'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = !selectedShipId ? 'rgba(37,99,235,0.06)' : 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = !selectedShipId ? 'rgba(37,99,235,0.06)' : 'transparent'}>
                        🌍 All Equipment
                        {!selectedShipId && <span style={{ marginLeft:'auto', color:'var(--accent-primary)' }}>✓</span>}
                      </button>
                      <div style={{ height:1, background:'var(--border-color)' }}></div>
                      {ships.map(ship => (
                        <div
                          key={ship.id}
                          style={{
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'space-between',
                            padding:'0.6rem 0.8rem',
                            background: selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'transparent',
                            transition:'background 0.1s',
                            borderBottom:'1px solid rgba(0,0,0,0.04)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'var(--bg-surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = selectedShipId === ship.id ? 'rgba(5,150,105,0.06)' : 'transparent'}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectShip(ship.id)}
                            style={{
                              display:'flex',
                              alignItems:'center',
                              gap:'0.5rem',
                              flex:1,
                              background:'transparent',
                              border:'none',
                              textAlign:'left',
                              cursor:'pointer',
                              fontSize:'0.88rem',
                              fontWeight: selectedShipId === ship.id ? '600' : '400',
                              color: selectedShipId === ship.id ? '#059669' : 'var(--text-primary)',
                              fontFamily:"'Inter',sans-serif"
                            }}
                          >
                            <span>🚢 {ship.ship_name}</span>
                            <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', background:'var(--bg-surface)', padding:'0.15rem 0.45rem', borderRadius:'0.5rem', border:'1px solid var(--border-color)' }}>
                              {ship.spec_count} specs
                            </span>
                            {selectedShipId === ship.id && <span style={{ color:'#059669', marginLeft:'0.25rem' }}>✓</span>}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowShipDropdown(false); handleOpenExportModal(ship); }}
                            style={{
                              background:'none',
                              border:'1px solid rgba(5,150,105,0.3)',
                              borderRadius:'var(--radius-sm)',
                              color:'#059669',
                              padding:'0.25rem 0.5rem',
                              fontSize:'0.75rem',
                              fontWeight:'600',
                              cursor:'pointer',
                              display:'inline-flex',
                              alignItems:'center',
                              gap:'0.25rem',
                              marginLeft:'0.5rem'
                            }}
                            title={`Download market parts for ${ship.ship_name} (.xlsx)`}
                          >
                            <span>📥 Download</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
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
              {filters.partCategory && <Chip label={`Category: ${filters.partCategory}`} onRemove={() => setFilters(f=>({...f,partCategory:''}))} />}
              {filters.condition && <Chip label={`Condition: ${filters.condition}`} onRemove={() => setFilters(f=>({...f,condition:''}))} />}
              <button onClick={clearAll} style={{ background:'none', border:'none', color:'var(--danger)', fontSize:'0.8rem', fontWeight:'600', cursor:'pointer', padding:'0.25rem 0.5rem' }}>Clear All</button>
            </div>
          )}
        </div>

        {/* Active Ship Status & Market Export Bar */}
        {selectedShip && (
          <div className="glass-card" style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            flexWrap:'wrap',
            gap:'0.75rem',
            padding:'1rem 1.5rem',
            marginBottom:'1.25rem',
            background:'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(16,185,129,0.06))',
            border:'1.5px solid rgba(5,150,105,0.3)',
            borderRadius:'var(--radius-md)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1.6rem' }}>🚢</span>
              <div>
                <div style={{ fontWeight:'700', fontSize:'0.98rem', color:'#059669', display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap' }}>
                  <span>Active Ship: <strong>{selectedShip.ship_name}</strong></span>
                  {selectedShip.imo_number && <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:'normal' }}>IMO: {selectedShip.imo_number}</span>}
                  {selectedShip.ship_type && <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:'normal' }}>• {selectedShip.ship_type}</span>}
                  <span style={{ fontSize:'0.75rem', background:'rgba(5,150,105,0.12)', color:'#059669', padding:'0.15rem 0.55rem', borderRadius:'1rem', fontWeight:'600' }}>
                    {savedSpecs.length} Equipment Specifications
                  </span>
                  {specsFilterActive ? (
                    <span style={{ fontSize:'0.72rem', background:'rgba(5,150,105,0.15)', color:'#059669', padding:'0.15rem 0.55rem', borderRadius:'1rem', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
                      ✓ Compatibility & Colors Active
                    </span>
                  ) : (
                    <span style={{ fontSize:'0.72rem', background:'rgba(245,158,11,0.15)', color:'#d97706', padding:'0.15rem 0.55rem', borderRadius:'1rem', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
                      🔍 Search Active (Filtered)
                    </span>
                  )}
                </div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginTop:'0.2rem' }}>
                  {specsFilterActive
                    ? 'Marketplace filtered to this ship specifications. Compatible, different specs (yellow), and unavailable (red) parts are highlighted below.'
                    : 'Showing keyword search results. Click "Restore Compatibility View" to re-enable ship specification matching with yellow & red rows.'}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'wrap' }}>
              {!specsFilterActive && savedSpecs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSpecsFilterActive(true);
                    setSearchQuery('');
                    toast.success('⚡ Restored Ship Specifications & Compatibility view!');
                  }}
                  className="btn btn-primary"
                  style={{
                    padding:'0.55rem 1.15rem',
                    fontSize:'0.85rem',
                    background:'linear-gradient(135deg, #f59e0b, #f97316)',
                    display:'inline-flex',
                    alignItems:'center',
                    gap:'0.45rem',
                    fontWeight:'600',
                    boxShadow:'0 2px 8px rgba(245,158,11,0.25)'
                  }}
                >
                  <span>⚡</span> Restore Compatibility View
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownloadShipData(selectedShip, 'detailed')}
                disabled={exportingCsv}
                className="btn btn-primary"
                style={{
                  padding:'0.55rem 1.15rem',
                  fontSize:'0.85rem',
                  background:'linear-gradient(135deg, #059669, #10b981)',
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'0.45rem',
                  fontWeight:'600',
                  boxShadow:'0 2px 8px rgba(5,150,105,0.25)'
                }}
              >
                <span>📥</span> {exportingCsv ? 'Downloading...' : 'Download Ship Data'}
              </button>
              <button
                type="button"
                onClick={() => handleOpenExportModal(selectedShip)}
                className="btn btn-secondary"
                style={{
                  padding:'0.55rem 0.95rem',
                  fontSize:'0.85rem',
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'0.4rem',
                  color:'#059669',
                  borderColor:'rgba(5,150,105,0.4)',
                  fontWeight:'600'
                }}
              >
                <span>📊</span> Preview & Options
              </button>
            </div>
          </div>
        )}

        {/* Inquiry Details (ETA/ETD/Vessel/Destination) */}
        <div className="glass-card" style={{ padding:'1.25rem 1.5rem', marginBottom:'1.25rem' }}>
          <h4 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1rem', fontWeight:'600', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            📋 Inquiry Details <span style={{ fontSize:'0.75rem', fontWeight:'400', color:'var(--text-muted)' }}>(Destination & ETA are compulsory)</span>
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
              <label className="form-label">Vessel Name <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:'normal' }}>(Optional)</span></label>
              <input className="form-input" placeholder="e.g., MV Ocean Star" value={inquiryMeta.vesselName} onChange={e=>setInquiryMeta(m=>({...m,vesselName:e.target.value}))} />
            </div>
          </div>
        </div>

        {/* Results — Single unified table */}
        {(!hasSearched && !selectedShipId) ? (
          <div className="glass-card empty-state" style={{ padding:'4rem 2rem', textAlign:'center' }}>
            <span style={{ fontSize:'3.5rem', display:'block', marginBottom:'1rem', animation:'float 4s ease-in-out infinite' }}>⚓</span>
            <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.3rem', fontWeight:'600', marginBottom:'0.5rem' }}>Search the Global Parts Database</h3>
            <p style={{ color:'var(--text-muted)', maxWidth:400, margin:'0 auto' }}>Use the search bar, select a ship, or apply filters to find the marine spare parts you need.</p>
          </div>
        ) : displayedProducts.length === 0 && !(
          specsFilterActive && specClassification.some(sc => !searchQuery.trim() || matchesSearch(searchQuery, sc.spec.equipment, sc.spec.manufacturer, sc.spec.model))
        ) ? (
          <div className="glass-card empty-state" style={{ padding:'3rem', textAlign:'center' }}>
            <span className="empty-state-icon">🌊</span>
            <p style={{ color:'var(--text-secondary)' }}>
              {searchQuery.trim()
                ? `No products or equipment found matching "${searchQuery}". Try broadening your search.`
                : 'No products found. Try broadening your search.'}
            </p>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ padding:'1.25rem', overflowX:'auto' }}>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem', marginBottom:'1rem' }}>
                <p style={{ color:'var(--text-secondary)', fontSize:'0.95rem', margin:0 }}>
                  {selectedShip && specsFilterActive ? (
                    <>
                      Showing equipment for <strong style={{ color:'var(--text-primary)' }}>{selectedShip.ship_name}</strong>
                      {searchQuery.trim() ? <> matching "<strong>{searchQuery}</strong>"</> : null}: {' '}
                      <strong style={{ color:'#059669' }}>{displayedProducts.length}</strong> compatible product listings, {' '}
                      <strong style={{ color:'#d97706' }}>{specClassification.filter(sc => sc.status === 'incompatible' && (!searchQuery.trim() || matchesSearch(searchQuery, sc.spec.equipment, sc.spec.manufacturer, sc.spec.model))).length}</strong> with different specs, {' '}
                      <strong style={{ color:'#dc2626' }}>{specClassification.filter(sc => sc.status === 'not_available' && (!searchQuery.trim() || matchesSearch(searchQuery, sc.spec.equipment, sc.spec.manufacturer, sc.spec.model))).length}</strong> not in market
                    </>
                  ) : (
                    <>Found <strong style={{ color:'var(--accent-primary)' }}>{displayedProducts.length}</strong> result{displayedProducts.length!==1?'s':''}</>
                  )}
                </p>
                {selectedShip && !specsFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpecsFilterActive(true);
                      setSearchQuery('');
                      toast.success(`⚡ Restored full equipment view for ${selectedShip.ship_name}!`);
                    }}
                    style={{
                      background:'rgba(5,150,105,0.1)',
                      border:'1px solid rgba(5,150,105,0.3)',
                      color:'#059669',
                      padding:'0.3rem 0.85rem',
                      borderRadius:'1rem',
                      fontSize:'0.82rem',
                      fontWeight:'600',
                      cursor:'pointer',
                      display:'inline-flex',
                      alignItems:'center',
                      gap:'0.35rem'
                    }}
                  >
                    ⚡ Show All {selectedShip.ship_name} Equipment
                  </button>
                )}
              </div>
              {(() => {
                const isSearchActive = Boolean(searchQuery.trim() || activeFilterCount > 0);

                // Build a randomized Seller ID map keyed by provider_id on search to hide seller identity
                const sellerIdMap = {};
                if (isSearchActive) {
                  const uniquePids = [];
                  displayedProducts.forEach(p => {
                    const pid = p.provider_id ?? p.seller_id ?? p.user_id;
                    if (pid !== undefined && pid !== null && !uniquePids.includes(pid)) {
                      uniquePids.push(pid);
                    }
                  });

                  // Randomize seller numbering (e.g. Seller 3, Seller 1, Seller 2...)
                  const sellerNumbers = seededShuffle(
                    uniquePids.map((_, idx) => idx + 1),
                    searchSeed + 42
                  );

                  uniquePids.forEach((pid, idx) => {
                    sellerIdMap[pid] = `Seller ${sellerNumbers[idx]}`;
                  });
                }

                const tableHeaders = [
                  ...(isSearchActive ? ['Seller ID'] : []),
                  'Equipment', 'Manufacturer', 'Model', 'Category', 'Part Name', 'Part No.', 'Location', 'QTY', 'Business Type', 'Payment', 'Condition', 'Warranty', 'Last Updated', 'Action'
                ];

                /* Column-width map for buyer table.
                   Narrow cols: Seller ID, QTY, Category, Condition, Payment, Warranty
                   Wide col: Part Name (wraps instead of truncating) */
                const colWidths = isSearchActive
                  ? { 'Seller ID': 90, 'Equipment': 110, 'Manufacturer': 110, 'Model': 100,
                      'Category': 85, 'Part Name': 220, 'Part No.': 105, 'Location': 105,
                      'QTY': 55, 'Business Type': 105, 'Payment': 95, 'Condition': 90,
                      'Warranty': 90, 'Last Updated': 95, 'Action': 145 }
                  : { 'Equipment': 120, 'Manufacturer': 120, 'Model': 105,
                      'Category': 85, 'Part Name': 235, 'Part No.': 110, 'Location': 110,
                      'QTY': 55, 'Business Type': 110, 'Payment': 95, 'Condition': 90,
                      'Warranty': 90, 'Last Updated': 95, 'Action': 150 };

                return (
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize:'0.9rem',
                              minWidth: isSearchActive ? 1490 : 1570,
                              tableLayout: 'fixed' }}>
                <colgroup>
                  {tableHeaders.map(h => (
                    <col key={h} style={{ width: colWidths[h] || 100 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border-color)' }}>
                    {tableHeaders.map(h => (
                      <th key={h} style={{
                        padding: '0.6rem 0.75rem',
                        fontWeight: '700',
                        /* Single consistent font size across ALL headers */
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: '1.3',
                        background: 'var(--bg-surface)',
                        borderBottom: '2px solid var(--border-color)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Compatible product rows (normal white rows) */}
                  {displayedProducts.map(p => {
                    const sending = sendingIds.has(p.id);
                    const pid = p.provider_id ?? p.seller_id ?? p.user_id;
                    const sellerLabel = sellerIdMap[pid] || '—';
                    return (
                      <tr key={p.id} style={{ borderBottom:'1px solid var(--border-color)', transition:'background 0.15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        {isSearchActive && (
                          <td style={{ padding:'0.75rem' }}>
                            <span style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              padding:'0.22rem 0.65rem', borderRadius:'1rem',
                              fontSize:'0.75rem', fontWeight:'700',
                              background:'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(99,102,241,0.12))',
                              color:'var(--accent-primary)', border:'1px solid rgba(37,99,235,0.22)',
                              whiteSpace:'nowrap', letterSpacing:'0.02em'
                            }}>{sellerLabel}</span>
                          </td>
                        )}
                        <td style={{ padding:'0.75rem' }}>{p.category||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.brand||'-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.model_number||'-'}</td>
                        <td style={{ padding:'0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: (p.part_category === 'Complete Set') ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            color: (p.part_category === 'Complete Set') ? '#2563eb' : '#059669'
                          }}>
                            {p.part_category || 'Spare Part'}
                          </span>
                        </td>
                        <td style={{ padding:'0.75rem', fontWeight:'500', whiteSpace:'normal', wordBreak:'break-word', lineHeight:'1.4' }} title={p.product_name || ''}>{p.product_name||'-'}</td>
                        <td style={{ padding:'0.75rem', fontFamily:'monospace', color:'var(--text-secondary)' }}>{p.part_number||'-'}</td>
                        <td style={{ padding:'0.75rem' }} title={p.location || ''}>{p.location||'-'}</td>
                        <td style={{ padding:'0.75rem', textAlign:'center', color:'var(--accent-primary)', fontWeight:'bold' }}>{p.quantity||'-'}</td>
                        <td style={{ padding:'0.75rem' }}>{p.service_type || 'Supply'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.payment_mode || 'pre-payment'}</td>
                        <td style={{ padding:'0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: (p.equipment_condition === 'Refurbished') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: (p.equipment_condition === 'Refurbished') ? '#b45309' : '#15803d'
                          }}>
                            {p.equipment_condition || 'New'}
                          </span>
                        </td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{p.warranty || '—'}</td>
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

                  {/* Incompatible spec rows (amber) — appended at bottom, filtered by query */}
                  {specsFilterActive && savedSpecs.length > 0 && specClassification
                    .filter(sc => {
                      if (sc.status !== 'incompatible') return false;
                      if (searchQuery.trim()) {
                        return matchesSearch(searchQuery, sc.spec.equipment, sc.spec.manufacturer, sc.spec.model);
                      }
                      return true;
                    })
                    .map((sc, i) => (
                      <tr key={`incompat-${sc.spec.id || i}`} style={{ borderBottom:'1px solid rgba(245,158,11,0.25)', background:'rgba(245,158,11,0.08)' }}>
                        {isSearchActive && (
                          <td style={{ padding:'0.75rem' }}><span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontStyle:'italic' }}>—</span></td>
                        )}
                        <td style={{ padding:'0.75rem', fontWeight:'600' }}>{sc.spec.equipment}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{sc.spec.manufacturer || '-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{sc.spec.model || '-'}</td>
                        <td colSpan={2} style={{ padding:'0.75rem' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:'0.3rem',
                            padding:'0.2rem 0.6rem', borderRadius:'1rem', fontSize:'0.72rem', fontWeight:'600',
                            background:'rgba(245,158,11,0.15)', color:'#d97706'
                          }}>
                            ⚠ Different Specs
                          </span>
                        </td>
                        <td style={{ padding:'0.75rem', color:'var(--text-muted)' }}>—</td>
                        <td style={{ padding:'0.75rem', fontWeight:'bold', color:'#d97706' }}>{sc.incompatibleCount}</td>
                        <td colSpan={6} style={{ padding:'0.75rem' }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSearchQuery(sc.spec.equipment);
                              setSpecsFilterActive(false);
                              setHasSearched(true);
                              // Activate compatible-options mode: only show Complete Sets, exclude original manufacturer
                              setCompatibleOptionsMode(true);
                              setCompatibleOptionsSpec({ equipment: sc.spec.equipment, manufacturer: sc.spec.manufacturer, model: sc.spec.model });
                              toast.success(`🔍 Showing Complete Set alternatives for "${sc.spec.equipment}" (${sc.spec.manufacturer || 'any'})...`);
                            }}
                            style={{
                              padding:'0.45rem 1rem',
                              fontSize:'0.82rem',
                              borderRadius:'var(--radius-full)',
                              background:'linear-gradient(135deg, #f59e0b, #f97316)',
                              display:'inline-flex',
                              alignItems:'center',
                              gap:'0.4rem',
                              fontWeight:'600',
                              whiteSpace:'nowrap',
                              boxShadow:'0 2px 6px rgba(245,158,11,0.25)'
                            }}
                          >
                            🔍 Explore Compatible Options
                          </button>
                        </td>
                      </tr>
                    ))
                  }

                  {/* Not available spec rows (red) — displayed in prominent red, filtered by query */}
                  {specsFilterActive && savedSpecs.length > 0 && specClassification
                    .filter(sc => {
                      if (sc.status !== 'not_available') return false;
                      if (searchQuery.trim()) {
                        return matchesSearch(searchQuery, sc.spec.equipment, sc.spec.manufacturer, sc.spec.model);
                      }
                      return true;
                    })
                    .map((sc, i) => (
                      <tr key={`unavail-${sc.spec.id || i}`} style={{ borderBottom:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.08)' }}>
                        {isSearchActive && (
                          <td style={{ padding:'0.75rem' }}><span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontStyle:'italic' }}>—</span></td>
                        )}
                        <td style={{ padding:'0.75rem', fontWeight:'600' }}>{sc.spec.equipment}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{sc.spec.manufacturer || '-'}</td>
                        <td style={{ padding:'0.75rem', color:'var(--text-secondary)' }}>{sc.spec.model || '-'}</td>
                        <td colSpan={2} style={{ padding:'0.75rem' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:'0.3rem',
                            padding:'0.2rem 0.6rem', borderRadius:'1rem', fontSize:'0.72rem', fontWeight:'600',
                            background:'rgba(239,68,68,0.15)', color:'#dc2626'
                          }}>
                            ✗ Not Available
                          </span>
                        </td>
                        <td style={{ padding:'0.75rem', color:'var(--text-muted)' }}>—</td>
                        <td style={{ padding:'0.75rem', fontWeight:'bold', color:'#dc2626' }}>0</td>
                        <td colSpan={6} style={{ padding:'0.75rem' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexWrap:'nowrap' }}>
                            <span style={{
                              padding:'0.35rem 0.8rem',
                              fontSize:'0.78rem',
                              borderRadius:'var(--radius-full)',
                              background:'rgba(239,68,68,0.12)',
                              color:'#dc2626',
                              border:'1px solid rgba(239,68,68,0.25)',
                              display:'inline-flex',
                              alignItems:'center',
                              gap:'0.35rem',
                              fontWeight:'600',
                              whiteSpace:'nowrap'
                            }}>
                              🚫 Not in Market
                            </span>
                            <span style={{ fontSize:'0.78rem', color:'#dc2626', fontStyle:'italic', lineHeight:'1.3', whiteSpace:'nowrap' }}>
                              {sc.reason || 'Not available in the market from any manufacturer or model'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
                );
              })()}
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

                {/* Model */}
                <div>
                  <SectionTitle icon="🔎" label="Model" />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search model..." value={filters.modelNumber}
                      onChange={e => setFilters(f=>({...f, modelNumber:e.target.value}))}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                </div>

                {/* Part No. */}
                <div>
                  <SectionTitle icon="🏷️" label="Part No." />
                  <div style={{ position:'relative', marginBottom:'0.75rem' }}>
                    <span style={{ position:'absolute', left:'0.85rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'0.9rem' }}>🔍</span>
                    <input className="form-input" placeholder="Search part no..." value={filters.partNumber}
                      onChange={e => setFilters(f=>({...f, partNumber:e.target.value}))}
                      style={{ paddingLeft:'2.5rem' }} />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <SectionTitle icon="📍" label="Location" />
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

                {/* Minimum QTY */}
                <div>
                  <SectionTitle icon="📦" label={`Minimum QTY: ${filters.minQty}`} />
                  <div style={{ padding:'0 0.25rem' }}>
                    <input type="range" min="1" max="100" value={filters.minQty}
                      onChange={e => setFilters(f=>({...f, minQty:Number(e.target.value)}))}
                      style={{ width:'100%', accentColor:'var(--accent-primary)', height:6, cursor:'pointer' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>
                      <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
                    </div>
                  </div>
                </div>

                {/* Business Type */}
                <div>
                  <SectionTitle icon="🛠️" label="Business Type" />
                  <select className="form-input" value={filters.serviceType} onChange={e => setFilters(f => ({...f, serviceType: e.target.value}))}>
                    <option value="">Any</option>
                    <option value="Supply">Supply</option>
                    <option value="Supply and Service">Supply and Service</option>
                  </select>
                </div>

                {/* Category (Part Category) */}
                <div>
                  <SectionTitle icon="📂" label="Category" />
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                    {['', 'Spare Part', 'Complete Set'].map(opt => (
                      <button
                        key={opt || 'any'}
                        type="button"
                        onClick={() => setFilters(f => ({...f, partCategory: opt}))}
                        style={{
                          padding:'0.45rem 1rem',
                          borderRadius:'var(--radius-full)',
                          border:`1.5px solid ${filters.partCategory === opt ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          background: filters.partCategory === opt ? 'var(--accent-primary)' : 'transparent',
                          color: filters.partCategory === opt ? 'white' : 'var(--text-secondary)',
                          fontSize:'0.84rem',
                          fontWeight:'600',
                          cursor:'pointer',
                          transition:'all 0.15s',
                          fontFamily:"'Inter',sans-serif"
                        }}
                      >
                        {opt || 'Any'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <SectionTitle icon="⚙️" label="Condition" />
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                    {['', 'New', 'Refurbished'].map(opt => (
                      <button
                        key={opt || 'any'}
                        type="button"
                        onClick={() => setFilters(f => ({...f, condition: opt}))}
                        style={{
                          padding:'0.45rem 1rem',
                          borderRadius:'var(--radius-full)',
                          border:`1.5px solid ${filters.condition === opt ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          background: filters.condition === opt ? 'var(--accent-primary)' : 'transparent',
                          color: filters.condition === opt ? 'white' : 'var(--text-secondary)',
                          fontSize:'0.84rem',
                          fontWeight:'600',
                          cursor:'pointer',
                          transition:'all 0.15s',
                          fontFamily:"'Inter',sans-serif"
                        }}
                      >
                        {opt || 'Any'}
                      </button>
                    ))}
                  </div>
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
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s' }}
             onClick={handleCloseShipsModal}>
          <div style={{ background:'var(--bg-card)', borderRadius:'var(--radius-lg)', boxShadow:'0 25px 60px rgba(0,0,0,0.25)', width:860, maxWidth:'95vw', maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden', animation:'scaleIn 0.25s' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(16,185,129,0.06))' }}>
              <div>
                <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'1.25rem', fontWeight:'700', margin:0, display:'flex', alignItems:'center', gap:'0.5rem', color:'var(--text-primary)' }}>🚢 Manage My Ships</h3>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', margin:'0.2rem 0 0' }}>Add ships, manage specifications manually, or import bulk specifications via Excel (.xlsx).</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <button
                  type="button"
                  onClick={downloadSampleExcel}
                  className="btn btn-secondary"
                  style={{ fontSize:'0.8rem', padding:'0.45rem 0.85rem', display:'inline-flex', alignItems:'center', gap:'0.4rem', color:'#059669', borderColor:'rgba(5,150,105,0.4)', background:'rgba(5,150,105,0.06)', fontWeight:'600' }}
                  title="Download sample .xlsx template for ship equipment specifications"
                >
                  <span>📥</span> Download Sample Template (.xlsx)
                </button>
                <button onClick={handleCloseShipsModal} style={{ background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'var(--text-muted)', padding:'0.25rem' }}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex:1, padding:'1.5rem', overflowY:'auto', background:'var(--bg-body)' }}>

              {/* Add New Ship Form */}
              <div className="glass-card" style={{ padding:'1.25rem', marginBottom:'1.5rem' }}>
                <h4 style={{ fontSize:'0.9rem', fontWeight:'600', marginBottom:'1rem', color:'var(--text-primary)' }}>➕ Add a New Ship</h4>
                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div style={{ flex:2, minWidth:200 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Name *</label>
                    <input className="form-input" placeholder="e.g. MV Ocean Star" value={newShipName} onChange={e=>setNewShipName(e.target.value)} />
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>IMO Number</label>
                    <input className="form-input" placeholder="e.g. 9123456" value={newShipImo} onChange={e=>setNewShipImo(e.target.value)} />
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Type</label>
                    <input className="form-input" placeholder="e.g. Bulk Carrier" value={newShipType} onChange={e=>setNewShipType(e.target.value)} />
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
                        onClick={() => handleExpandShip(ship.id)}
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
                        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenExportModal(ship); }}
                            className="btn btn-secondary"
                            style={{
                              padding:'0.25rem 0.65rem',
                              fontSize:'0.75rem',
                              fontWeight:'600',
                              color:'#059669',
                              borderColor:'rgba(5,150,105,0.3)',
                              background:'rgba(5,150,105,0.06)',
                              display:'inline-flex',
                              alignItems:'center',
                              gap:'0.3rem'
                            }}
                            title={`Download Market Inventory for ${ship.ship_name} (.xlsx)`}
                          >
                            <span>📥</span> Download Data
                          </button>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', padding:'0.25rem 0.6rem', borderRadius:'1rem', fontSize:'0.75rem', fontWeight:'600', background: ship.spec_count > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(100,100,100,0.1)', color: ship.spec_count > 0 ? '#059669' : 'var(--text-secondary)' }}>
                            {ship.spec_count || 0} Specifications
                          </span>
                          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ transition:'transform 0.2s', transform: expandedShipId === ship.id ? 'rotate(180deg)' : 'none', color:'var(--text-muted)' }}><path d="M1.5 1.5L6 6L10.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      </div>

                      {/* Ship Details (Expanded) */}
                      {expandedShipId === ship.id && (
                        <div style={{ padding:'1.25rem', borderTop:'1px solid var(--border-color)', background:'var(--bg-card)', animation:'fadeIn 0.2s' }} onClick={e => e.stopPropagation()}>
                          
                          {/* Ship Information / Inline Edit Card */}
                          {editingShipId === ship.id ? (
                            <div style={{ padding:'1rem', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid #059669', marginBottom:'1.25rem' }}>
                              <h5 style={{ margin:'0 0 0.75rem', fontSize:'0.85rem', fontWeight:'600', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                                ✏️ Update Ship Details
                              </h5>
                              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
                                <div style={{ flex:2, minWidth:180 }}>
                                  <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Name *</label>
                                  <input className="form-input" value={editShipForm.ship_name} onChange={e => setEditShipForm({ ...editShipForm, ship_name: e.target.value })} />
                                </div>
                                <div style={{ flex:1, minWidth:120 }}>
                                  <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>IMO Number</label>
                                  <input className="form-input" value={editShipForm.imo_number} onChange={e => setEditShipForm({ ...editShipForm, imo_number: e.target.value })} />
                                </div>
                                <div style={{ flex:1, minWidth:120 }}>
                                  <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Ship Type</label>
                                  <input className="form-input" value={editShipForm.ship_type} onChange={e => setEditShipForm({ ...editShipForm, ship_type: e.target.value })} />
                                </div>
                                <div style={{ display:'flex', gap:'0.5rem' }}>
                                  <button className="btn btn-primary" onClick={() => handleUpdateShip(ship.id)} disabled={savingShip || !editShipForm.ship_name.trim()} style={{ height:'40px', padding:'0 1rem', background:'linear-gradient(135deg, #059669, #10b981)' }}>
                                    {savingShip ? 'Saving...' : '💾 Save'}
                                  </button>
                                  <button className="btn btn-secondary" onClick={() => setEditingShipId(null)} style={{ height:'40px', padding:'0 0.9rem' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem', padding:'0.75rem 1rem', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-color)', marginBottom:'1.25rem' }}>
                              <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', display:'flex', gap:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
                                <span><strong>Ship Name:</strong> {ship.ship_name}</span>
                                <span><strong>IMO:</strong> {ship.imo_number || '—'}</span>
                                <span><strong>Type:</strong> {ship.ship_type || '—'}</span>
                              </div>
                              <div style={{ display:'flex', gap:'0.5rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => handleOpenExportModal(ship)}
                                  style={{ padding:'0.35rem 0.75rem', fontSize:'0.78rem', display:'inline-flex', alignItems:'center', gap:'0.35rem', color:'#059669', borderColor:'rgba(5,150,105,0.4)', background:'rgba(5,150,105,0.06)', fontWeight:'600' }}
                                >
                                  📥 Download Market Data
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => handleStartEditShip(ship)}
                                  style={{ padding:'0.35rem 0.75rem', fontSize:'0.78rem', display:'inline-flex', alignItems:'center', gap:'0.35rem' }}
                                >
                                  ✏️ Edit Ship
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => { if(window.confirm(`Are you sure you want to delete "${ship.ship_name}" and all its specifications?`)) handleDeleteShip(ship.id, ship.ship_name); }}
                                  style={{ padding:'0.35rem 0.75rem', fontSize:'0.78rem', color:'var(--danger)', borderColor:'rgba(239,68,68,0.3)' }}
                                >
                                  🗑️ Delete Ship
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Specification Sub-Navigation Tabs */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem', marginBottom:'1rem' }}>
                            <div style={{ display:'flex', gap:'0.4rem', background:'var(--bg-surface)', padding:'0.25rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)' }}>
                              <button
                                type="button"
                                onClick={() => setShipSpecsTab('specs')}
                                style={{
                                  padding:'0.45rem 0.9rem',
                                  borderRadius:'var(--radius-sm)',
                                  border:'none',
                                  background: shipSpecsTab === 'specs' ? '#059669' : 'transparent',
                                  color: shipSpecsTab === 'specs' ? 'white' : 'var(--text-secondary)',
                                  fontWeight:'600',
                                  fontSize:'0.82rem',
                                  cursor:'pointer',
                                  display:'inline-flex',
                                  alignItems:'center',
                                  gap:'0.4rem',
                                  transition:'all 0.15s'
                                }}
                              >
                                📋 Specifications List ({expandedShipSpecs.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setShipSpecsTab('upload')}
                                style={{
                                  padding:'0.45rem 0.9rem',
                                  borderRadius:'var(--radius-sm)',
                                  border:'none',
                                  background: shipSpecsTab === 'upload' ? '#059669' : 'transparent',
                                  color: shipSpecsTab === 'upload' ? 'white' : 'var(--text-secondary)',
                                  fontWeight:'600',
                                  fontSize:'0.82rem',
                                  cursor:'pointer',
                                  display:'inline-flex',
                                  alignItems:'center',
                                  gap:'0.4rem',
                                  transition:'all 0.15s'
                                }}
                              >
                                📤 Bulk Excel Upload
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={downloadSampleExcel}
                              className="btn btn-secondary"
                              style={{
                                fontSize:'0.8rem',
                                padding:'0.45rem 0.85rem',
                                display:'inline-flex',
                                alignItems:'center',
                                gap:'0.4rem',
                                color:'#059669',
                                borderColor:'rgba(5,150,105,0.4)',
                                background:'rgba(5,150,105,0.06)',
                                fontWeight:'600'
                              }}
                              title="Download sample .xlsx template"
                            >
                              <span>📥</span> Download Sample Template (.xlsx)
                            </button>
                          </div>

                          {/* ═══ TAB 1: SPECIFICATIONS LIST & MANUAL ENTRY ═══ */}
                          {shipSpecsTab === 'specs' && (
                            <div>
                              {/* Add Specification Manually Form */}
                              <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-color)', padding:'1rem', marginBottom:'1.25rem' }}>
                                <h6 style={{ margin:'0 0 0.75rem', fontSize:'0.85rem', fontWeight:'600', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                                  ➕ Add Specification Manually
                                </h6>
                                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
                                  <div style={{ flex:2, minWidth:180 }}>
                                    <label style={{ display:'block', fontSize:'0.72rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Equipment Name *</label>
                                    <input
                                      className="form-input"
                                      placeholder="e.g. Main Engine, Purifier, Radar"
                                      value={newManualSpec.equipment}
                                      onChange={e => setNewManualSpec({ ...newManualSpec, equipment: e.target.value })}
                                      onKeyDown={e => { if (e.key === 'Enter') handleAddManualSpec(ship.id); }}
                                    />
                                  </div>
                                  <div style={{ flex:2, minWidth:150 }}>
                                    <label style={{ display:'block', fontSize:'0.72rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Manufacturer</label>
                                    <input
                                      className="form-input"
                                      placeholder="e.g. MAN B&W, Alfa Laval, Furuno"
                                      value={newManualSpec.manufacturer}
                                      onChange={e => setNewManualSpec({ ...newManualSpec, manufacturer: e.target.value })}
                                      onKeyDown={e => { if (e.key === 'Enter') handleAddManualSpec(ship.id); }}
                                    />
                                  </div>
                                  <div style={{ flex:2, minWidth:140 }}>
                                    <label style={{ display:'block', fontSize:'0.72rem', fontWeight:'600', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>Model</label>
                                    <input
                                      className="form-input"
                                      placeholder="e.g. 6S50MC, PureBilge, FAR-2117"
                                      value={newManualSpec.model}
                                      onChange={e => setNewManualSpec({ ...newManualSpec, model: e.target.value })}
                                      onKeyDown={e => { if (e.key === 'Enter') handleAddManualSpec(ship.id); }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleAddManualSpec(ship.id)}
                                    disabled={addingManualSpec || !newManualSpec.equipment.trim()}
                                    style={{ height:'40px', padding:'0 1.25rem', background:'linear-gradient(135deg, #059669, #10b981)', fontSize:'0.82rem', fontWeight:'600' }}
                                  >
                                    {addingManualSpec ? 'Adding...' : '➕ Add Spec'}
                                  </button>
                                </div>
                              </div>

                              {/* Search & Header for Existing Specs */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem', marginBottom:'0.75rem' }}>
                                <span style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--text-primary)' }}>
                                  Current Specifications ({expandedShipSpecs.length})
                                </span>
                                {expandedShipSpecs.length > 3 && (
                                  <div style={{ position:'relative', width:220 }}>
                                    <input
                                      className="form-input"
                                      style={{ padding:'0.35rem 0.6rem 0.35rem 1.8rem', fontSize:'0.8rem', height:'32px' }}
                                      placeholder="Search specs..."
                                      value={specSearchQuery}
                                      onChange={e => setSpecSearchQuery(e.target.value)}
                                    />
                                    <span style={{ position:'absolute', left:'0.55rem', top:'50%', transform:'translateY(-50%)', fontSize:'0.8rem', color:'var(--text-muted)' }}>🔍</span>
                                    {specSearchQuery && (
                                      <button onClick={() => setSpecSearchQuery('')} style={{ position:'absolute', right:'0.5rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:'0.75rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Specs Table */}
                              {loadingShipSpecs ? (
                                <div style={{ textAlign:'center', padding:'2.5rem 1rem', color:'var(--text-muted)' }}>
                                  ⏳ Loading specifications...
                                </div>
                              ) : expandedShipSpecs.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'2.5rem 1rem', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px dashed var(--border-color)', color:'var(--text-muted)' }}>
                                  <span style={{ fontSize:'1.8rem', display:'block', marginBottom:'0.5rem' }}>📋</span>
                                  <p style={{ margin:'0 0 0.35rem', fontWeight:'500', color:'var(--text-secondary)', fontSize:'0.9rem' }}>No specifications added yet for {ship.ship_name}</p>
                                  <p style={{ margin:0, fontSize:'0.8rem' }}>Add specifications manually above, or switch to the <strong>Bulk Excel Upload</strong> tab to upload an Excel file.</p>
                                </div>
                              ) : filteredShipSpecs.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-muted)', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)' }}>
                                  No specifications match "{specSearchQuery}".
                                </div>
                              ) : (
                                <div style={{ maxHeight:'280px', overflowY:'auto', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)' }}>
                                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                                    <thead>
                                      <tr style={{ background:'var(--bg-surface)', borderBottom:'2px solid var(--border-color)', position:'sticky', top:0, zIndex:2 }}>
                                        <th style={{ padding:'0.55rem 0.6rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)', width:'40px' }}>#</th>
                                        <th style={{ padding:'0.55rem 0.6rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Equipment</th>
                                        <th style={{ padding:'0.55rem 0.6rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Manufacturer</th>
                                        <th style={{ padding:'0.55rem 0.6rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Model</th>
                                        <th style={{ padding:'0.55rem 0.6rem', textAlign:'right', fontWeight:'600', color:'var(--text-muted)', width:'110px' }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredShipSpecs.map((spec, i) => (
                                        <tr key={spec.id || i} style={{ borderBottom:'1px solid var(--border-color)', background: editingSpecId === spec.id ? 'rgba(5,150,105,0.05)' : undefined }}>
                                          {editingSpecId === spec.id ? (
                                            <>
                                              <td style={{ padding:'0.4rem 0.5rem', color:'var(--text-muted)' }}>{i + 1}</td>
                                              <td style={{ padding:'0.4rem 0.5rem' }}>
                                                <input
                                                  className="form-input"
                                                  style={{ padding:'0.3rem 0.5rem', fontSize:'0.8rem', height:'32px' }}
                                                  value={editSpecForm.equipment}
                                                  onChange={e => setEditSpecForm({ ...editSpecForm, equipment: e.target.value })}
                                                  placeholder="Equipment Name *"
                                                />
                                              </td>
                                              <td style={{ padding:'0.4rem 0.5rem' }}>
                                                <input
                                                  className="form-input"
                                                  style={{ padding:'0.3rem 0.5rem', fontSize:'0.8rem', height:'32px' }}
                                                  value={editSpecForm.manufacturer}
                                                  onChange={e => setEditSpecForm({ ...editSpecForm, manufacturer: e.target.value })}
                                                  placeholder="Manufacturer"
                                                />
                                              </td>
                                              <td style={{ padding:'0.4rem 0.5rem' }}>
                                                <input
                                                  className="form-input"
                                                  style={{ padding:'0.3rem 0.5rem', fontSize:'0.8rem', height:'32px' }}
                                                  value={editSpecForm.model}
                                                  onChange={e => setEditSpecForm({ ...editSpecForm, model: e.target.value })}
                                                  placeholder="Model"
                                                />
                                              </td>
                                              <td style={{ padding:'0.4rem 0.5rem', textAlign:'right' }}>
                                                <div style={{ display:'flex', gap:'0.35rem', justifyContent:'flex-end' }}>
                                                  <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={() => handleUpdateManualSpec(ship.id, spec.id)}
                                                    disabled={savingSpecId === spec.id || !editSpecForm.equipment.trim()}
                                                    style={{ padding:'0.25rem 0.55rem', fontSize:'0.75rem', background:'#059669' }}
                                                    title="Save changes"
                                                  >
                                                    {savingSpecId === spec.id ? '...' : '✓ Save'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => setEditingSpecId(null)}
                                                    style={{ padding:'0.25rem 0.5rem', fontSize:'0.75rem' }}
                                                    title="Cancel"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td style={{ padding:'0.45rem 0.6rem', color:'var(--text-muted)' }}>{i + 1}</td>
                                              <td style={{ padding:'0.45rem 0.6rem', fontWeight:'600', color:'var(--text-primary)' }}>{spec.equipment}</td>
                                              <td style={{ padding:'0.45rem 0.6rem', color:'var(--text-secondary)' }}>{spec.manufacturer || '—'}</td>
                                              <td style={{ padding:'0.45rem 0.6rem', color:'var(--text-secondary)' }}>{spec.model || '—'}</td>
                                              <td style={{ padding:'0.45rem 0.6rem', textAlign:'right' }}>
                                                <div style={{ display:'flex', gap:'0.35rem', justifyContent:'flex-end' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleStartEditSpec(spec)}
                                                    style={{ background:'none', border:'1px solid var(--border-color)', borderRadius:'var(--radius-sm)', padding:'0.2rem 0.45rem', fontSize:'0.75rem', cursor:'pointer', color:'var(--text-secondary)' }}
                                                    title="Edit specification"
                                                  >
                                                    ✏️
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => { if (window.confirm(`Delete "${spec.equipment}" specification?`)) handleDeleteManualSpec(ship.id, spec.id); }}
                                                    style={{ background:'none', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'0.2rem 0.45rem', fontSize:'0.75rem', cursor:'pointer', color:'var(--danger)' }}
                                                    title="Delete specification"
                                                  >
                                                    🗑️
                                                  </button>
                                                </div>
                                              </td>
                                            </>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ═══ TAB 2: BULK EXCEL UPLOAD ═══ */}
                          {shipSpecsTab === 'upload' && (
                            <div>
                              {/* Instructions & Template info card */}
                              <div style={{ background:'rgba(5,150,105,0.04)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:'var(--radius-sm)', padding:'0.9rem 1.1rem', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem' }}>
                                <div>
                                  <p style={{ margin:0, fontSize:'0.82rem', color:'var(--text-primary)', fontWeight:'500' }}>
                                    📄 Required Excel columns: <strong>Equipment</strong>. Optional columns: <strong>Manufacturer</strong>, <strong>Model</strong>.
                                  </p>
                                  <p style={{ margin:'0.2rem 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
                                    Need help with the file format? Download the sample template to see the expected format.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={downloadSampleExcel}
                                  className="btn btn-secondary"
                                  style={{ fontSize:'0.78rem', padding:'0.35rem 0.75rem', display:'inline-flex', alignItems:'center', gap:'0.35rem', color:'#059669', borderColor:'#059669', background:'white' }}
                                >
                                  📥 Download Sample Template (.xlsx)
                                </button>
                              </div>

                              {/* Upload Mode Selector */}
                              <div style={{ display:'flex', gap:'1.25rem', alignItems:'center', marginBottom:'1rem', padding:'0.6rem 0.8rem', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border-color)', fontSize:'0.8rem' }}>
                                <span style={{ fontWeight:'600', color:'var(--text-secondary)' }}>Upload Mode:</span>
                                <label style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', cursor:'pointer', color:'var(--text-primary)' }}>
                                  <input
                                    type="radio"
                                    name={`upload-mode-${ship.id}`}
                                    value="replace"
                                    checked={csvUploadMode === 'replace'}
                                    onChange={() => setCsvUploadMode('replace')}
                                  />
                                  <span>Replace existing specifications</span>
                                </label>
                                <label style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', cursor:'pointer', color:'var(--text-primary)' }}>
                                  <input
                                    type="radio"
                                    name={`upload-mode-${ship.id}`}
                                    value="append"
                                    checked={csvUploadMode === 'append'}
                                    onChange={() => setCsvUploadMode('append')}
                                  />
                                  <span>Append to existing specifications</span>
                                </label>
                              </div>

                              {/* Dropzone Area */}
                              <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; handleSpecsFile(file); }}
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
                                onClick={() => document.getElementById(`specs-excel-input-${ship.id}`).click()}
                              >
                                <input
                                  id={`specs-excel-input-${ship.id}`}
                                  type="file"
                                  accept=".xlsx, .xls, .csv"
                                  style={{ display: 'none' }}
                                  onChange={(e) => { handleSpecsFile(e.target.files[0]); e.target.value = ''; }}
                                />
                                <span style={{ fontSize:'2rem', display:'block', marginBottom:'0.5rem' }}>{csvFileName ? '✅' : '📊'}</span>
                                {csvFileName ? (
                                  <>
                                    <p style={{ fontWeight:'600', color:'#059669', marginBottom:'0.25rem', fontSize:'0.9rem' }}>{csvFileName}</p>
                                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{csvPreview.length} row(s) parsed. Click to select a different file.</p>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ fontWeight:'600', color:'var(--text-primary)', marginBottom:'0.25rem', fontSize:'0.9rem' }}>Upload Specifications (.xlsx) for {ship.ship_name}</p>
                                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>Drag & drop your Excel (.xlsx) file here, or click to browse</p>
                                    {ship.spec_count > 0 && csvUploadMode === 'replace' && (
                                      <p style={{ fontSize:'0.75rem', color:'var(--danger)', marginTop:'0.5rem', fontWeight:'500' }}>
                                        ⚠️ Note: Uploading in "Replace" mode will overwrite {ship.spec_count} existing specification(s).
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Specifications Preview Table */}
                              {csvPreview.length > 0 && (
                                <div style={{ marginBottom:'1.25rem' }}>
                                  <h4 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'0.9rem', fontWeight:'600', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                    👁️ Preview ({csvPreview.length} rows to {csvUploadMode === 'replace' ? 'replace' : 'append'})
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
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      onClick={() => handleSaveSpecs(ship.id)}
                                      disabled={specsSaving}
                                      style={{ padding:'0.6rem 1.5rem', background:'linear-gradient(135deg, #059669, #10b981)', fontSize:'0.85rem' }}
                                    >
                                      {specsSaving ? 'Saving...' : `💾 Save ${csvPreview.length} Specs to Ship`}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => { setCsvPreview([]); setCsvFileName(''); }}
                                      style={{ padding:'0.6rem 1.2rem', fontSize:'0.85rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-card)' }}>
              <button
                type="button"
                onClick={downloadSampleExcel}
                className="btn btn-secondary"
                style={{ fontSize:'0.82rem', padding:'0.5rem 1rem', display:'inline-flex', alignItems:'center', gap:'0.4rem', color:'#059669', borderColor:'rgba(5,150,105,0.4)', background:'rgba(5,150,105,0.05)' }}
              >
                <span>📥</span> Download Sample Template (.xlsx)
              </button>
              <button className="btn btn-secondary" onClick={handleCloseShipsModal} style={{ padding:'0.6rem 1.5rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHIP MARKET AVAILABILITY EXPORT MODAL ═══ */}
      {showExportModal && exportModalShip && (
        <div
          style={{
            position:'fixed',
            inset:0,
            zIndex:1100,
            background:'rgba(0,0,0,0.6)',
            backdropFilter:'blur(5px)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            animation:'fadeIn 0.2s',
            padding:'1rem'
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            style={{
              background:'var(--bg-card)',
              borderRadius:'var(--radius-lg)',
              boxShadow:'0 25px 60px rgba(0,0,0,0.35)',
              width:880,
              maxWidth:'95vw',
              maxHeight:'90vh',
              display:'flex',
              flexDirection:'column',
              overflow:'hidden',
              animation:'scaleIn 0.25s',
              border:'1px solid var(--border-color)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding:'1.25rem 1.5rem',
              borderBottom:'1px solid var(--border-color)',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center',
              background:'linear-gradient(135deg, rgba(5,150,105,0.08), rgba(16,185,129,0.08))'
            }}>
              <div>
                <h3 style={{
                  fontFamily:"'Outfit',sans-serif",
                  fontSize:'1.3rem',
                  fontWeight:'700',
                  margin:0,
                  display:'flex',
                  alignItems:'center',
                  gap:'0.5rem',
                  color:'var(--text-primary)'
                }}>
                  <span>📥</span> Download Ship Data — {exportModalShip.ship_name}
                </h3>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', margin:'0.25rem 0 0' }}>
                  Market availability of equipment and spare parts for <strong>{exportModalShip.ship_name}</strong>
                  {exportModalShip.imo_number && ` (IMO: ${exportModalShip.imo_number})`}
                  {exportModalShip.ship_type && ` • ${exportModalShip.ship_type}`}
                </p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background:'none',
                  border:'none',
                  fontSize:'1.3rem',
                  cursor:'pointer',
                  color:'var(--text-muted)',
                  padding:'0.25rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ flex:1, padding:'1.5rem', overflowY:'auto', background:'var(--bg-body)' }}>
              {loadingExportPreview ? (
                <div style={{ textAlign:'center', padding:'3rem 1rem', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>⏳</div>
                  <h4 style={{ fontSize:'1.1rem', fontWeight:'600', color:'var(--text-primary)', marginBottom:'0.5rem' }}>
                    Analyzing Market Availability...
                  </h4>
                  <p style={{ fontSize:'0.85rem' }}>Matching equipment specifications for {exportModalShip.ship_name} against live market inventory...</p>
                </div>
              ) : exportPreviewData ? (
                <>
                  {/* Summary Metric Cards */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'0.85rem', marginBottom:'1.5rem' }}>
                    <div className="glass-card" style={{ padding:'1rem', background:'var(--bg-surface)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'600', textTransform:'uppercase', color:'var(--text-muted)', letterSpacing:'0.5px' }}>
                        Ship Equipment Specs
                      </span>
                      <div style={{ fontSize:'1.6rem', fontWeight:'700', color:'var(--text-primary)', marginTop:'0.25rem' }}>
                        {exportPreviewData.summary.total_equipment}
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Configured specifications</span>
                    </div>

                    <div className="glass-card" style={{ padding:'1rem', background:'var(--bg-surface)', border:'1px solid rgba(5,150,105,0.3)', borderRadius:'var(--radius-md)' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'600', textTransform:'uppercase', color:'#059669', letterSpacing:'0.5px' }}>
                        Available In Market
                      </span>
                      <div style={{ fontSize:'1.6rem', fontWeight:'700', color:'#059669', marginTop:'0.25rem' }}>
                        {exportPreviewData.summary.equipment_with_stock} <span style={{ fontSize:'0.9rem', fontWeight:'500', color:'var(--text-muted)' }}>/ {exportPreviewData.summary.total_equipment}</span>
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                        {exportPreviewData.summary.equipment_out_of_stock > 0 ? `${exportPreviewData.summary.equipment_out_of_stock} out of stock` : '100% in stock'}
                      </span>
                    </div>

                    <div className="glass-card" style={{ padding:'1rem', background:'var(--bg-surface)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'var(--radius-md)' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'600', textTransform:'uppercase', color:'var(--accent-primary)', letterSpacing:'0.5px' }}>
                        Matching Market Parts
                      </span>
                      <div style={{ fontSize:'1.6rem', fontWeight:'700', color:'var(--accent-primary)', marginTop:'0.25rem' }}>
                        {exportPreviewData.summary.total_market_listings}
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Live market listings</span>
                    </div>

                    <div className="glass-card" style={{ padding:'1rem', background:'var(--bg-surface)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'600', textTransform:'uppercase', color:'var(--text-muted)', letterSpacing:'0.5px' }}>
                        Total Quantity Available
                      </span>
                      <div style={{ fontSize:'1.6rem', fontWeight:'700', color:'var(--text-primary)', marginTop:'0.25rem' }}>
                        {exportPreviewData.summary.total_market_quantity}
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Units in supplier inventory</span>
                    </div>
                  </div>

                  
                  {/* Equipment Specifications & Market Availability Breakdown Tabs */}
                  {(() => {
                    const allEquipment = exportPreviewData.equipment || [];
                    const availableItems = allEquipment.filter(eq => eq.compatibility_status === 'compatible');
                    const unavailableItems = allEquipment.filter(eq => eq.compatibility_status !== 'compatible');
                    const displayedTabItems = exportBreakdownTab === 'available' ? availableItems : unavailableItems;

                    const getUniqueBrands = (items) => {
                      const seen = new Set();
                      const list = [];
                      (items || []).forEach(p => {
                        const brand = (p.brand || '').trim();
                        if (brand && !seen.has(brand.toLowerCase())) {
                          seen.add(brand.toLowerCase());
                          list.push(brand);
                        }
                      });
                      return list;
                    };

                    const getUniquePartNames = (items) => {
                      const seen = new Set();
                      const list = [];
                      (items || []).forEach(p => {
                        const name = (p.product_name || '').trim();
                        if (name && !seen.has(name.toLowerCase())) {
                          seen.add(name.toLowerCase());
                          list.push(name);
                        }
                      });
                      return list;
                    };

                    return (
                      <>
                        {/* Section Header & Breakdown Tabs */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem', marginBottom:'0.85rem' }}>
                          <h4 style={{ fontSize:'0.95rem', fontWeight:'600', margin:0, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                            <span>📋</span> Equipment Availability Breakdown ({allEquipment.length})
                          </h4>

                          <div style={{ display:'flex', gap:'0.4rem', background:'var(--bg-surface)', padding:'0.25rem', borderRadius:'var(--radius-full)', border:'1px solid var(--border-color)' }}>
                            <button
                              type="button"
                              onClick={() => setExportBreakdownTab('available')}
                              style={{
                                padding:'0.45rem 1rem',
                                borderRadius:'var(--radius-full)',
                                fontSize:'0.82rem',
                                fontWeight:'600',
                                cursor:'pointer',
                                display:'inline-flex',
                                alignItems:'center',
                                gap:'0.45rem',
                                transition:'all 0.15s',
                                background: exportBreakdownTab === 'available' ? 'linear-gradient(135deg, #059669, #10b981)' : 'transparent',
                                color: exportBreakdownTab === 'available' ? 'white' : 'var(--text-secondary)',
                                border:'none',
                                boxShadow: exportBreakdownTab === 'available' ? '0 2px 6px rgba(5,150,105,0.25)' : 'none'
                              }}
                            >
                              <span>🟢 Available Items</span>
                              <span style={{
                                background: exportBreakdownTab === 'available' ? 'rgba(255,255,255,0.25)' : 'rgba(5,150,105,0.12)',
                                color: exportBreakdownTab === 'available' ? 'white' : '#059669',
                                padding:'0.1rem 0.5rem',
                                borderRadius:'1rem',
                                fontSize:'0.72rem',
                                fontWeight:'700'
                              }}>
                                {availableItems.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExportBreakdownTab('unavailable')}
                              style={{
                                padding:'0.45rem 1rem',
                                borderRadius:'var(--radius-full)',
                                fontSize:'0.82rem',
                                fontWeight:'600',
                                cursor:'pointer',
                                display:'inline-flex',
                                alignItems:'center',
                                gap:'0.45rem',
                                transition:'all 0.15s',
                                background: exportBreakdownTab === 'unavailable' ? 'linear-gradient(135deg, #f59e0b, #f97316)' : 'transparent',
                                color: exportBreakdownTab === 'unavailable' ? 'white' : 'var(--text-secondary)',
                                border:'none',
                                boxShadow: exportBreakdownTab === 'unavailable' ? '0 2px 6px rgba(245,158,11,0.25)' : 'none'
                              }}
                            >
                              <span>🟠 Not Available Items (Compatible Options)</span>
                              <span style={{
                                background: exportBreakdownTab === 'unavailable' ? 'rgba(255,255,255,0.25)' : 'rgba(245,158,11,0.15)',
                                color: exportBreakdownTab === 'unavailable' ? 'white' : '#d97706',
                                padding:'0.1rem 0.5rem',
                                borderRadius:'1rem',
                                fontSize:'0.72rem',
                                fontWeight:'700'
                              }}>
                                {unavailableItems.length}
                              </span>
                            </button>
                          </div>
                        </div>

                        {allEquipment.length === 0 ? (
                          <div style={{ textAlign:'center', padding:'2.5rem', background:'var(--bg-surface)', borderRadius:'var(--radius-md)', border:'1px dashed var(--border-color)', color:'var(--text-muted)' }}>
                            <span style={{ fontSize:'2rem', display:'block', marginBottom:'0.5rem' }}>⚙️</span>
                            <p style={{ fontWeight:'500', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>No equipment specifications configured</p>
                            <p style={{ fontSize:'0.82rem' }}>Add specifications to this ship to see available market spare parts and stock quantities.</p>
                          </div>
                        ) : displayedTabItems.length === 0 ? (
                          <div style={{ textAlign:'center', padding:'2.5rem', background:'var(--bg-surface)', borderRadius:'var(--radius-md)', border:'1px dashed var(--border-color)', color:'var(--text-muted)' }}>
                            <span style={{ fontSize:'2rem', display:'block', marginBottom:'0.5rem' }}>
                              {exportBreakdownTab === 'available' ? '🔍' : '🎉'}
                            </span>
                            <p style={{ fontWeight:'600', color:'var(--text-primary)', marginBottom:'0.25rem' }}>
                              {exportBreakdownTab === 'available'
                                ? 'No fully compatible items currently found in market'
                                : 'Great! All equipment items are available in the marketplace'}
                            </p>
                            <p style={{ fontSize:'0.82rem' }}>
                              {exportBreakdownTab === 'available'
                                ? 'Switch to "Not Available Items (Compatible Options)" tab to see market alternatives.'
                                : 'All your ship specifications have matching marketplace parts.'}
                            </p>
                          </div>
                        ) : exportBreakdownTab === 'available' ? (
                          /* ── Tab 1: Available Items Table ── */
                          <div style={{ maxHeight:'340px', overflowY:'auto', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                              <thead>
                                <tr style={{ background:'var(--bg-surface)', borderBottom:'2px solid var(--border-color)', position:'sticky', top:0, zIndex:2 }}>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)', width:'40px' }}>#</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Equipment</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Manufacturer</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'center', fontWeight:'600', color:'var(--text-muted)' }}>Number of Sellers</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'center', fontWeight:'600', color:'var(--text-muted)' }}>Total Spares Qty</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Available Parts Preview</th>
                                </tr>
                              </thead>
                              <tbody>
                                {availableItems.map((eq, i) => {
                                  const uniqueParts = getUniquePartNames(eq.products);
                                  return (
                                    <tr key={eq.id || i} style={{ borderBottom:'1px solid var(--border-color)' }}>
                                      <td style={{ padding:'0.6rem 0.75rem', color:'var(--text-muted)' }}>{i + 1}</td>
                                      <td style={{ padding:'0.6rem 0.75rem', fontWeight:'600', color:'var(--text-primary)' }}>{eq.equipment}</td>
                                      <td style={{ padding:'0.6rem 0.75rem', color:'var(--text-secondary)' }}>{eq.manufacturer || '—'}</td>
                                      <td style={{ padding:'0.6rem 0.75rem', textAlign:'center', fontWeight:'600', color:'var(--text-primary)' }}>
                                        {eq.available_listings_count} seller{eq.available_listings_count !== 1 ? 's' : ''}
                                      </td>
                                      <td style={{ padding:'0.6rem 0.75rem', textAlign:'center', fontWeight:'700', color:'#059669' }}>
                                        {eq.total_available_quantity} units
                                      </td>
                                      <td style={{ padding:'0.6rem 0.75rem', color:'var(--text-secondary)', fontSize:'0.82rem' }}>
                                        {uniqueParts.length > 0 ? (
                                          <span title={uniqueParts.join(', ')}>
                                            {uniqueParts.slice(0, 3).join(', ')}
                                            {uniqueParts.length > 3 && ` + ${uniqueParts.length - 3} more`}
                                          </span>
                                        ) : (
                                          <span style={{ color:'var(--text-muted)' }}>—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          /* ── Tab 2: Not Available Items (With Compatible Options) Table ── */
                          <div style={{ maxHeight:'340px', overflowY:'auto', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                              <thead>
                                <tr style={{ background:'var(--bg-surface)', borderBottom:'2px solid var(--border-color)', position:'sticky', top:0, zIndex:2 }}>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)', width:'40px' }}>#</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Equipment</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'center', fontWeight:'600', color:'var(--text-muted)' }}>Number of Sellers</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'center', fontWeight:'600', color:'var(--text-muted)' }}>Available Quantity/Set</th>
                                  <th style={{ padding:'0.65rem 0.75rem', textAlign:'left', fontWeight:'600', color:'var(--text-muted)' }}>Available Brand</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unavailableItems.map((eq, i) => {
                                  const isAlt = eq.compatibility_status === 'incompatible';
                                  const rowBg = isAlt ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)';
                                  const brands = getUniqueBrands(eq.equipment_only_products);
                                  return (
                                    <tr key={eq.id || i} style={{ borderBottom:'1px solid var(--border-color)', background: rowBg }}>
                                      <td style={{ padding:'0.6rem 0.75rem', color:'var(--text-muted)' }}>{i + 1}</td>
                                      <td style={{ padding:'0.6rem 0.75rem', fontWeight:'600', color:'var(--text-primary)' }}>{eq.equipment}</td>
                                      <td style={{ padding:'0.6rem 0.75rem', textAlign:'center', fontWeight:'600', color: eq.equipment_only_listings_count > 0 ? '#d97706' : 'var(--text-muted)' }}>
                                        {eq.equipment_only_listings_count > 0 ? `${eq.equipment_only_listings_count} seller${eq.equipment_only_listings_count !== 1 ? 's' : ''}` : '0'}
                                      </td>
                                      <td style={{ padding:'0.6rem 0.75rem', textAlign:'center', fontWeight:'700', color: eq.equipment_only_total_quantity > 0 ? '#d97706' : 'var(--text-muted)' }}>
                                        {eq.equipment_only_total_quantity > 0 ? `${eq.equipment_only_total_quantity} units` : '0'}
                                      </td>
                                      <td style={{ padding:'0.6rem 0.75rem', color:'var(--text-secondary)', fontSize:'0.82rem' }}>
                                        {brands.length > 0 ? (
                                          <span style={{ color:'#d97706', fontWeight:'600' }}>{brands.join(', ')}</span>
                                        ) : (
                                          <span style={{ color:'#dc2626', fontStyle:'italic' }}>
                                            {eq.compatibility_reason || 'Not in Market'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-muted)' }}>
                  Failed to load preview data.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding:'1rem 1.5rem',
              borderTop:'1px solid var(--border-color)',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center',
              background:'var(--bg-card)',
              flexWrap:'wrap',
              gap:'0.75rem'
            }}>
              <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                <span>💡</span> Excel file contains two sheets: "Available Items" and "Not Available Items".
              </span>
              <div style={{ display:'flex', gap:'0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowExportModal(false)}
                  style={{ padding:'0.5rem 1.25rem', fontSize:'0.85rem' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleDownloadShipData(exportModalShip)}
                  disabled={exportingCsv}
                  style={{
                    padding:'0.55rem 1.4rem',
                    fontSize:'0.88rem',
                    background:'linear-gradient(135deg, #059669, #10b981)',
                    display:'inline-flex',
                    alignItems:'center',
                    gap:'0.45rem',
                    fontWeight:'600',
                    boxShadow:'0 2px 8px rgba(5,150,105,0.25)'
                  }}
                >
                  <span>📥</span> {exportingCsv ? 'Downloading...' : 'Download Equipment Availability Breakdown (.xlsx)'}
                </button>
              </div>
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
