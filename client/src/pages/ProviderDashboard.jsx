import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MarineNewsTicker from '../components/MarineNewsTicker';
import UploadModal from '../components/UploadModal';
import SellerIntelligenceModal from '../components/SellerIntelligenceModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API = '/api';

// Low-stock warning (red pop-up). Must match LOW_STOCK_THRESHOLD in server/cron.js,
// which emails the same warning to sellers every day at 5 PM.
const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_POPUP_MS = 10 * 1000;            // pop-up stays on screen for 10 s
const LOW_STOCK_INTERVAL_MS = 90 * 60 * 1000;    // and comes back every 90 min

const showLowStockPopup = (products) => {
  const lowStock = products.filter(p => (Number(p.quantity) || 0) < LOW_STOCK_THRESHOLD);
  if (lowStock.length === 0) return false;
  const opts = (id) => ({ duration: LOW_STOCK_POPUP_MS, id, style: { fontSize: '0.9rem', padding: '12px 16px' } });
  lowStock.slice(0, 3).forEach(p => {
    const name = (p.product_name || '').trim() || (p.part_number ? `Part No. ${p.part_number}` : p.category || 'A product');
    toast.error(`${name} is running low, you have only ${Number(p.quantity) || 0} left! Please refill or update your stock.`, opts(`low_stock_${p.id}`));
  });
  if (lowStock.length > 3) {
    toast.error(`And ${lowStock.length - 3} more products are running low.`, opts('low_stock_more'));
  }
  return true;
};

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push('...');
    pages.push(total);
  }
  return pages;
};

/* ── Provider (Seller) Dashboard — column definitions for drag-and-drop reordering ──
   `key`  = the underlying data field on each product object
   `label` = the visible header text
   The `#` (row number) and `Delete` columns are fixed at the start/end and
   are NOT reorderable. Only the 15 columns below can be dragged. */
const PROVIDER_COL_DEFS = {
  department:            { label: 'Department',     width: 100 },
  category:              { label: 'Equipment',      width: 110 },
  brand:                 { label: 'Manufacturer',   width: 110 },
  model_number:          { label: 'Model',          width: 100 },
  serial_number:         { label: 'Serial No.',     width: 110 },
  manufactured_at:       { label: 'Authorization',  width: 80  },
  part_category:         { label: 'Category',       width: 95  },
  product_name:          { label: 'Part Name',      width: 230 },
  part_number:           { label: 'Part No.',       width: 105 },
  location:              { label: 'Location',       width: 110 },
  quantity:              { label: 'QTY',            width: 55  },
  service_type:          { label: 'Business Type', width: 105 },
  payment_mode:          { label: 'Payment Mode',  width: 100 },
  equipment_condition:   { label: 'Condition',      width: 90  },
  warranty:              { label: 'Warranty',       width: 90  },
};
const PROVIDER_DEFAULT_COL_ORDER = Object.keys(PROVIDER_COL_DEFS);
const PROVIDER_COL_STORAGE_KEY = 'providerColumnOrder';

export default function ProviderDashboard() {
  const { user, token } = useAuth();
  const [provider, setProvider] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingIds, setEditingIds] = useState([]);
  const [editDataMap, setEditDataMap] = useState({});
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);

  // Low-stock pop-up: on arrival, then every 90 min. The last time it was shown is kept in
  // localStorage so reloading the page or editing products doesn't bring it back early.
  const productsRef = useRef(products);
  productsRef.current = products;
  const [productsLoaded, setProductsLoaded] = useState(false);
  useEffect(() => {
    if (!productsLoaded || !user) return;
    const key = `lowStockPopupAt_${user.id}`;
    const check = () => {
      const last = Number(localStorage.getItem(key)) || 0;
      if (Date.now() - last < LOW_STOCK_INTERVAL_MS) return;
      if (showLowStockPopup(productsRef.current)) localStorage.setItem(key, String(Date.now()));
    };
    check();
    const timer = setInterval(check, 60 * 1000);
    return () => clearInterval(timer);
  }, [productsLoaded, user]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  // Pagination: 15 items per page
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Reset to page 1 when search or department filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartment]);

  // Unsaved-changes warning modal
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  /* ── Drag-and-drop column reordering (persisted to localStorage) ── */
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(PROVIDER_COL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Keep only valid keys; append any newly-added columns at the end
        const valid = parsed.filter(k => PROVIDER_COL_DEFS[k]);
        PROVIDER_DEFAULT_COL_ORDER.forEach(k => { if (!valid.includes(k)) valid.push(k); });
        return valid.length ? valid : [...PROVIDER_DEFAULT_COL_ORDER];
      }
    } catch (e) { /* fall through to default */ }
    return [...PROVIDER_DEFAULT_COL_ORDER];
  });
  const [draggingCol, setDraggingCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const handleColDragStart = (key) => setDraggingCol(key);
  const handleColDragEnd = () => { setDraggingCol(null); setDragOverCol(null); };
  const handleColDragOver = (e, key) => { e.preventDefault(); if (key !== draggingCol) setDragOverCol(key); };
  const handleColDrop = (key) => {
    if (!draggingCol || draggingCol === key) { setDraggingCol(null); setDragOverCol(null); return; }
    setColumnOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggingCol);
      const toIdx = newOrder.indexOf(key);
      if (fromIdx === -1 || toIdx === -1) return prev;
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggingCol);
      localStorage.setItem(PROVIDER_COL_STORAGE_KEY, JSON.stringify(newOrder));
      return newOrder;
    });
    setDraggingCol(null);
    setDragOverCol(null);
  };
  const resetColumnOrder = () => {
    setColumnOrder([...PROVIDER_DEFAULT_COL_ORDER]);
    localStorage.removeItem(PROVIDER_COL_STORAGE_KEY);
    toast.success('Column order reset to default');
  };
  const navigate = useNavigate();
  const spreadsheetRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Click outside spreadsheet — show save warning if edits are pending
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (spreadsheetRef.current && !spreadsheetRef.current.contains(e.target)) {
        // Always deselect highlighted rows
        setSelectedIds([]);

        // If there are unsaved individual-row edits, show warning instead of silently discarding
        if (!isBulkEditing && editingIds.length > 0) {
          setShowUnsavedModal(true);
          return;
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBulkEditing, editingIds]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/seller/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProvider(res.data.seller || res.data.provider);
      const fetchedProducts = res.data.products || [];
      setProducts(fetchedProducts);
      setProductsLoaded(true);
      
      // Default to "All Departments" (selectedDepartment remains empty string '')
      
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // "Update Inventory": confirms the stock is current (buyers and resellers see today's
  // date as Last Updated, and it counts as account activity), then opens every row for editing.
  const [confirmingInventory, setConfirmingInventory] = useState(false);
  const handleUpdateInventory = async () => {
    setConfirmingInventory(true);
    try {
      const res = await axios.post(`${API}/seller/inventory/confirm`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setProvider(prev => prev ? { ...prev, inventory_verified_at: res.data.inventoryVerifiedAt } : prev);
      toast.success('Inventory marked as up to date. Edit any item below and click Save.');
      if (products.length > 0 && !isBulkEditing) startBulkEdit();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update inventory status.');
    } finally {
      setConfirmingInventory(false);
    }
  };

  const startBulkEdit = () => {
    setIsBulkEditing(true);
    const newEditDataMap = {};
    products.forEach(p => {
      newEditDataMap[p.id] = {
        product_name: p.product_name || '',
        category: p.category || '',
        part_category: p.part_category || 'Spare Part',
        part_number: p.part_number || '',
        brand: p.brand || '',
        model_number: p.model_number || '',
        serial_number: p.serial_number || '',
        location: p.location || '',
        quantity: p.quantity || 0,
        price: p.price || 0,
        description: p.description || '',
        manufactured_at: p.manufactured_at || '',
        additional_info: p.additional_info || '',
        equipment_condition: p.equipment_condition || 'New',
        service_type: p.service_type || 'Supply',
        payment_mode: p.payment_mode || 'pre-payment',
        warranty: p.warranty || '',
        department: p.department || selectedDepartment || '',
        id: p.id
      };
    });
    setEditingIds(products.map(p => p.id));
    setEditDataMap(newEditDataMap);
  };

  const startEditSelected = () => {
    if (selectedIds.length === 0) return;
    setIsBulkEditing(false);
    const newEditDataMap = {};
    products.forEach(p => {
      if (selectedIds.includes(p.id)) {
        newEditDataMap[p.id] = {
          product_name: p.product_name || '',
          category: p.category || '',
          part_category: p.part_category || 'Spare Part',
          part_number: p.part_number || '',
          brand: p.brand || '',
          model_number: p.model_number || '',
          serial_number: p.serial_number || '',
          location: p.location || '',
          quantity: p.quantity || 0,
          price: p.price || 0,
          description: p.description || '',
          manufactured_at: p.manufactured_at || '',
          additional_info: p.additional_info || '',
          equipment_condition: p.equipment_condition || 'New',
          service_type: p.service_type || 'Supply',
          payment_mode: p.payment_mode || 'pre-payment',
          warranty: p.warranty || '',
          department: p.department || selectedDepartment || '',
          id: p.id
        };
      }
    });
    setEditingIds(selectedIds);
    setEditDataMap(newEditDataMap);
  };


  const startEditingRow = (product) => {
    // Don't allow toggling individual rows during bulk edit
    if (isBulkEditing) return;
    if (editingIds.includes(product.id)) {
      // Double-click again on same row → exit edit mode for that row
      setEditingIds(prev => prev.filter(id => id !== product.id));
      setEditDataMap(prev => {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      });
    } else {
      // Double-click on a new row → clear selection, edit ONLY this row
      setSelectedIds([]);
      setEditingIds([product.id]);
      setEditDataMap({
        [product.id]: {
          product_name: product.product_name || '',
          category: product.category || '',
          part_category: product.part_category || 'Spare Part',
          part_number: product.part_number || '',
          brand: product.brand || '',
          model_number: product.model_number || '',
          serial_number: product.serial_number || '',
          location: product.location || '',
          quantity: product.quantity || 0,
          price: product.price || 0,
          description: product.description || '',
          manufactured_at: product.manufactured_at || '',
          additional_info: product.additional_info || '',
          equipment_condition: product.equipment_condition || 'New',
          service_type: product.service_type || 'Supply',
          payment_mode: product.payment_mode || 'pre-payment',
          warranty: product.warranty || '',
          department: product.department || selectedDepartment || '',
          id: product.id
        }
      });
    }
  };

  const cancelBulkEdits = () => {
    setIsBulkEditing(false);
    setEditingIds([]);
    setEditDataMap({});
    setShowUnsavedModal(false);
    // Remove any unsaved temporary rows
    setProducts(prev => prev.filter(p => !String(p.id).startsWith('temp_')));
  };

  const addNewRow = () => {
    const tempId = `temp_${Date.now()}`;
    const allDepartments = [...new Set(products.map(p => p.department).filter(Boolean))];
    const defaultDept = selectedDepartment || (allDepartments.length > 0 ? allDepartments[0] : 'General');
    const newRow = {
      id: tempId,
      product_name: '',
      category: '',
      part_category: 'Spare Part',
      brand: '',
      model_number: '',
      serial_number: '',
      part_number: '',
      manufactured_at: 'No',
      location: '',
      quantity: 1,
      price: 0,
      description: '',
      additional_info: '',
      equipment_condition: 'New',
      service_type: 'Supply',
      payment_mode: 'pre-payment',
      warranty: '',
      department: defaultDept
    };
    
    // Add to products
    setProducts(prev => [newRow, ...prev]);
    
    // Auto-enter edit mode for this row
    setEditingIds(prev => [...prev, tempId]);
    setEditDataMap(prev => ({
      ...prev,
      [tempId]: { ...newRow }
    }));
  };

  const handleBulkEditChange = (id, field, value) => {
    setEditDataMap(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const saveBulkEdits = async () => {
    // ── Validate all required fields before saving ──
    const requiredFields = [
      { key: 'category',      label: 'Equipment' },
      { key: 'brand',         label: 'Manufacturer' },
      { key: 'model_number',  label: 'Model' },
      { key: 'serial_number', label: 'Serial No.' },
      { key: 'product_name',  label: 'Part Name' },
      { key: 'location',      label: 'Location' },
      { key: 'quantity',      label: 'QTY' },
    ];

    for (let i = 0; i < editingIds.length; i++) {
      const id = editingIds[i];
      const row = editDataMap[id];
      if (!row) continue;
      for (const f of requiredFields) {
        const val = row[f.key];
        const isEmpty = val === undefined || val === null || String(val).trim() === '' || (f.key === 'quantity' && (Number(val) <= 0));
        if (isEmpty) {
          const rowNum = products.findIndex(p => p.id === id) + 1;
          toast.error(`Row ${rowNum}: "${f.label}" is required and cannot be empty.`, { duration: 5000 });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const updatedProducts = editingIds.map(id => editDataMap[id]);
      await axios.post(`${API}/seller/products/bulk-update`, { products: updatedProducts }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Refetch profile to get the real database IDs for any newly inserted rows
      await fetchProfile();
      
      setIsBulkEditing(false);
      setEditingIds([]);
      setEditDataMap({});
      toast.success('All changes saved successfully!');
    } catch (err) {
      console.error('Failed to update products:', err);
      alert(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    // If user starts selecting rows, exit any individual row edits
    if (editingIds.length > 0 && !isBulkEditing) {
      setEditingIds([]);
      setEditDataMap({});
    }
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    // If it's a temporary unsaved row, just remove it from frontend
    if (String(id).startsWith('temp_')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      return;
    }

    setDeleting(true);
    try {
      await axios.delete(`${API}/seller/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected products?`)) return;
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setDeleting(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/seller/products/bulk-delete`, { ids: realIds }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete products');
    } finally {
      setDeleting(false);
    }
  };

  const bulkUpdateServiceType = async (serviceType) => {
    if (selectedIds.length === 0) return;
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setSaving(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/seller/products/bulk-update-service-type`, { ids: realIds, serviceType }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, service_type: serviceType } : p));
      toast.success(`Service Type set to "${serviceType}" for ${selectedIds.length} items`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update service type');
    } finally {
      setSaving(false);
    }
  };

  const bulkUpdatePaymentMode = async (paymentMode) => {
    if (selectedIds.length === 0) return;
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setSaving(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/seller/products/bulk-update-payment-mode`, { ids: realIds, paymentMode }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, payment_mode: paymentMode } : p));
      toast.success(`Payment Mode set to "${paymentMode}" for ${selectedIds.length} items`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update payment mode');
    } finally {
      setSaving(false);
    }
  };

  const bulkUpdateCondition = async (condition) => {
    if (selectedIds.length === 0) return;
    
    const realIds = selectedIds.filter(id => !String(id).startsWith('temp_'));
    
    setSaving(true);
    try {
      if (realIds.length > 0) {
        await axios.post(`${API}/seller/products/bulk-update-condition`, { ids: realIds, condition }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, equipment_condition: condition } : p));
      toast.success(`Equipment Condition set to "${condition}" for ${selectedIds.length} items`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update equipment condition');
    } finally {
      setSaving(false);
    }
  };

  const deleteAll = async () => {
    if (products.length === 0) return;
    if (!window.confirm('WARNING: Are you sure you want to delete ALL your products? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/seller/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts([]);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete all products');
    } finally {
      setDeleting(false);
    }
  };

  const downloadCSV = () => {
    if (products.length === 0) return;
    
    // Headers: Department, Equipment, Manufacturer, Model, Serial No., Authorization, Category, Part Name, Part No., Location, QTY, Business Type, Payment Mode, Condition, Warranty
    const headers = ['Department', 'Equipment', 'Manufacturer', 'Model', 'Serial No.', 'Authorization', 'Category', 'Part Name', 'Part No.', 'Location', 'QTY', 'Business Type', 'Payment Mode', 'Condition', 'Warranty'];
    
    const rows = products.map(p => [
      p.department || '',
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.serial_number || '',
      p.manufactured_at || '',
      p.part_category || 'Spare Part',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply',
      p.payment_mode || 'pre-payment',
      p.equipment_condition || 'New',
      p.warranty || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'seller_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const highlightText = (text, query) => {
    if (!query || text === undefined || text === null || text === '') return text || '—';
    const strText = String(text);
    if (!strText) return '—';
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = strText.split(regex);
    
    if (parts.length === 1) return strText;
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: '#fef08a', color: '#854d0e', borderRadius: '2px', padding: '0 2px', fontWeight: 600 }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const downloadExcel = () => {
    if (products.length === 0) return;
    const headers = ['Department', 'Equipment', 'Manufacturer', 'Model', 'Serial No.', 'Authorization', 'Category', 'Part Name', 'Part No.', 'Location', 'QTY', 'Business Type', 'Payment Mode', 'Condition', 'Warranty'];
    const rows = products.map(p => [
      p.department || '',
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.serial_number || '',
      p.manufactured_at || '',
      p.part_category || 'Spare Part',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply',
      p.payment_mode || 'pre-payment',
      p.equipment_condition || 'New',
      p.warranty || ''
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "seller_products.xlsx");
  };

  const downloadPDF = () => {
    if (products.length === 0) return;
    const doc = new jsPDF();
    const headers = [['Department', 'Equipment', 'Manufacturer', 'Model', 'Serial No.', 'Authorization', 'Category', 'Part Name', 'Part No.', 'Location', 'QTY', 'Business Type', 'Payment', 'Condition', 'Warranty']];
    const rows = products.map(p => [
      p.department || '',
      p.category || '',
      p.brand || '',
      p.model_number || '',
      p.serial_number || '',
      p.manufactured_at || '',
      p.part_category || 'Spare Part',
      p.product_name || '',
      p.part_number || '',
      p.location || '',
      p.quantity || 0,
      p.service_type || 'Supply',
      p.payment_mode || 'pre-payment',
      p.equipment_condition || 'New',
      p.warranty || ''
    ]);
    
    doc.autoTable({
      head: headers,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save('seller_products.pdf');
  };

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Stable sort: computed once when products list changes — prevents rows jumping on selection
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aLow = Number(a.quantity) < 3 ? 0 : 1;
      const bLow = Number(b.quantity) < 3 ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return 0;
    });
  }, [products]);

  // Filtered products with search and department filtering
  const filteredProducts = useMemo(() => {
    return sortedProducts.filter(p => {
      if (selectedDepartment && p.department !== selectedDepartment && !String(p.id).startsWith('temp_')) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.part_category && p.part_category.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model_number && p.model_number.toLowerCase().includes(q)) ||
        (p.serial_number && p.serial_number.toLowerCase().includes(q)) ||
        (p.part_number && p.part_number.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.manufactured_at && String(p.manufactured_at).toLowerCase().includes(q)) ||
        (p.service_type && p.service_type.toLowerCase().includes(q)) ||
        (p.equipment_condition && p.equipment_condition.toLowerCase().includes(q)) ||
        (p.warranty && p.warranty.toLowerCase().includes(q)) ||
        (p.quantity !== undefined && p.quantity !== null && String(p.quantity).includes(q))
      );
    });
  }, [sortedProducts, selectedDepartment, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const editInput = (id, field, style = {}) => (
    <input
      className="inline-edit-input"
      value={editDataMap[id]?.[field] || ''}
      onChange={(e) => handleBulkEditChange(id, field, e.target.value)}
      style={style}
      autoFocus={field === 'product_name'}
    />
  );

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        {/* Ocean & Marine News Ticker Banner */}
        <MarineNewsTicker />

        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="menu-btn" 
              onClick={() => setIsSidebarOpen(true)}
              title="Show Company Info"
            >
              ☰
            </button>
            <div>
              <h1>Seller Dashboard</h1>
              <p>
                Manage your company profile and product listings
                {provider && (
                  <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Inventory last updated: <strong>{(() => {
                      const latest = [provider.inventory_verified_at, ...products.map(p => p.updated_at)].filter(Boolean).map(d => new Date(d)).sort((a, b) => b - a)[0];
                      return latest ? latest.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
                    })()}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={products.length === 0}
            >
              Download Data
            </button>
            
            {showDownloadMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.5rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
                overflow: 'hidden'
              }}>
                <button className="menu-item-btn" onClick={() => { downloadCSV(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>Download CSV</button>
                <button className="menu-item-btn" onClick={() => { downloadExcel(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>Download Excel</button>
                <button className="menu-item-btn" onClick={() => { downloadPDF(); setShowDownloadMenu(false); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)' }}>Download PDF</button>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleUpdateInventory}
              disabled={!provider || confirmingInventory}
              title="Confirm your stock is current and edit any item"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
            >
              {confirmingInventory ? 'Updating…' : 'Update Inventory'}
            </button>

            <button 
              className="btn btn-primary"
              onClick={() => setShowUploadModal(true)}
            >
              Master Upload
            </button>
            
            {/* Department Dropdown */}
            {[...new Set(products.map(p => p.department).filter(Boolean))].length > 0 && (
              <select 
                className="form-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                style={{ width: 'auto', padding: '0.6rem 1rem' }}
              >
                <option value="">All Departments</option>
                {[...new Set(products.map(p => p.department).filter(Boolean))].map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            )}

            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/seller/inquiries')}
            >
              View Inquiries
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowIntelligence(true)}
              disabled={!provider}
              style={{ color: '#2563eb', borderColor: 'rgba(37,99,235,0.4)', fontWeight: 600 }}
            >
              Seller Intelligence
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '40px', height: '40px' }}></div>
          </div>
        ) : !provider ? (
          <div className="glass-card empty-state">
            <h3>No seller profile found</h3>
            <p>Please complete your registration to get started.</p>
          </div>
        ) : (
          <>
            {/* Sidebar Overlay */}
            {isSidebarOpen && (
              <div 
                className="sidebar-overlay" 
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <div className={`info-sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header">
                <h2>Company Overview</h2>
                <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
              </div>
              
              <div className="sidebar-content">
                {/* Company Info Card */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-section-title">
                    {provider.company_name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <p>{provider.contact_person}</p>
                    <p>{provider.email}</p>
                    <p>{provider.phone}</p>
                    <p>{provider.address}{provider.city ? `, ${provider.city}` : ''}{provider.country ? `, ${provider.country}` : ''}</p>
                    <p>Payment Mode: {provider.payment_mode || 'N/A'}</p>
                  </div>
                  {provider.description && (
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {provider.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="stats-sidebar-grid">
                  <div className="stat-card">
                    <div className="stat-value">{products.length}</div>
                    <div className="stat-label">Listed Products</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{new Set(products.map((p) => p.category)).size}</div>
                    <div className="stat-label">Categories</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{products.reduce((sum, p) => sum + (p.quantity || 0), 0)}</div>
                    <div className="stat-label">Total Stock</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Excel-like Spreadsheet ===== */}
            <div style={{ marginTop: '0.5rem' }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
                Your Products
              </h2>

              {products.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No products listed yet.</p>
              ) : (
                <div ref={spreadsheetRef} style={{ animation: 'slideUp 0.5s ease-out' }}>
                  {/* Search Bar - above toolbar */}
                  <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="reset-cols-btn" onClick={resetColumnOrder} title="Reset columns to the default order">
                      ↺ Reset Columns
                    </button>
                    <input 
                      type="text" 
                      placeholder="Search parts, categories, brands..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.85rem', 
                        borderRadius: '4px', 
                        border: '1px solid #b0b8c8', 
                        width: '250px',
                        outline: 'none',
                        fontFamily: "'Inter', sans-serif"
                      }}
                    />
                  </div>

                  {/* Spreadsheet Toolbar — like Excel's ribbon */}
                  <div className="spreadsheet-toolbar">
                    {isBulkEditing || editingIds.length > 0 ? (
                      <>
                        <button className="toolbar-btn toolbar-btn-success" onClick={saveBulkEdits} disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="toolbar-btn" onClick={cancelBulkEdits} disabled={saving}>
                          Cancel
                        </button>
                        <div className="toolbar-separator" />
                        <button className="toolbar-btn" onClick={addNewRow} disabled={saving}>
                          Add Row
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedIds.length > 0 ? (
                          <div className="bulk-toolbar-row">
                            {/* Selection count and clear/all */}
                            <div className="bulk-group bulk-selection-group">
                              <span className="bulk-selection-pill">{selectedIds.length} Selected
                              </span>
                              <button 
                                type="button" 
                                className="toolbar-btn toolbar-btn-subtle" 
                                onClick={() => setSelectedIds([])}
                                title="Clear selection"
                              >
                                Clear
                              </button>
                              {selectedIds.length < products.length && (
                                <button 
                                  type="button" 
                                  className="toolbar-btn toolbar-btn-subtle" 
                                  onClick={() => setSelectedIds(products.map(p => p.id))}
                                  title="Select all products"
                                >
                                  Select All ({products.length})
                                </button>
                              )}
                            </div>

                            <div className="toolbar-separator" />

                            {/* Business Type Group */}
                            <div className="bulk-group">
                              <span className="bulk-group-title">Business:</span>
                              <div className="bulk-btn-cluster">
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill" 
                                  onClick={() => bulkUpdateServiceType('Supply')} 
                                  disabled={saving}
                                  title="Set Service Type to 'Supply' for all selected products"
                                >
                                  Supply
                                </button>
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill" 
                                  onClick={() => bulkUpdateServiceType('Supply and Service')} 
                                  disabled={saving}
                                  title="Set Service Type to 'Supply and Service' for all selected products"
                                >
                                  Supply & Svc
                                </button>
                              </div>
                            </div>

                            <div className="toolbar-separator" />

                            {/* Payment Mode Group */}
                            <div className="bulk-group">
                              <span className="bulk-group-title">Payment:</span>
                              <div className="bulk-btn-cluster">
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill" 
                                  onClick={() => bulkUpdatePaymentMode('pre-payment')} 
                                  disabled={saving}
                                  title="Set Payment Mode to 'pre-payment' for all selected products"
                                >
                                  Pre-payment
                                </button>
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill" 
                                  onClick={() => bulkUpdatePaymentMode('credit')} 
                                  disabled={saving}
                                  title="Set Payment Mode to 'credit' for all selected products"
                                >
                                  Credit
                                </button>
                              </div>
                            </div>

                            <div className="toolbar-separator" />

                            {/* Equipment Condition Group */}
                            <div className="bulk-group">
                              <span className="bulk-group-title">Condition:</span>
                              <div className="bulk-btn-cluster">
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill bulk-pill-new" 
                                  onClick={() => bulkUpdateCondition('New')} 
                                  disabled={saving}
                                  title="Set Condition to 'New' for all selected products"
                                >
                                  <span className="bulk-dot dot-new" /> New
                                </button>
                                <button 
                                  type="button" 
                                  className="toolbar-btn bulk-action-pill bulk-pill-refurb" 
                                  onClick={() => bulkUpdateCondition('Refurbished')} 
                                  disabled={saving}
                                  title="Set Condition to 'Refurbished' for all selected products"
                                >
                                  <span className="bulk-dot dot-refurb" /> Refurbished
                                </button>
                              </div>
                            </div>

                            <div className="toolbar-separator" />

                            {/* Actions Group */}
                            <div className="bulk-group bulk-actions-group">
                              <button 
                                type="button" 
                                className="toolbar-btn toolbar-btn-primary" 
                                onClick={startEditSelected}
                                title="Edit selected rows inline"
                              >
                                Edit
                              </button>
                              <button 
                                type="button" 
                                className="toolbar-btn toolbar-btn-danger" 
                                onClick={bulkDelete} 
                                disabled={deleting}
                                title="Delete selected products"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button className="toolbar-btn toolbar-btn-primary" onClick={startBulkEdit}>
                              Edit All
                            </button>
                            <button className="toolbar-btn" onClick={addNewRow}>
                              Add Row
                            </button>
                            <div className="toolbar-separator" />
                            <button className="toolbar-btn" onClick={() => setSelectedIds(products.map(p => p.id))}>
                              Select All
                            </button>
                          </>
                        )}
                      </>
                    )}

                    <span className="toolbar-info">
                      {selectedIds.length > 0 ? `${selectedIds.length} of ${products.length} selected` : `${products.length} rows`}
                      {editingIds.length > 0 ? ` · ${editingIds.length} editing` : ''}
                    </span>
                  </div>

                  {/* The Spreadsheet Grid */}
                  <div className="seller-products-table-wrap provider-products-table-wrap" style={{ borderTop: 'none', borderRadius: '0' }}>
                    <table className="data-table seller-products-table provider-products-table">
                      {/* colgroup driven by columnOrder so drag-and-drop widths stay in sync */}
                      <colgroup>
                        <col style={{ width: '40px' }} />{/* # — fixed */}
                        {columnOrder.map(key => (
                          <col key={key} style={{ width: PROVIDER_COL_DEFS[key]?.width + 'px' }} />
                        ))}
                        <col style={{ width: '70px' }} />{/* Delete — fixed */}
                      </colgroup>
                      <thead>
                        <tr>
                          {/* Row-number header — fixed, not draggable */}
                          <th title="Row number">#</th>
                          {/* Draggable column headers */}
                          {columnOrder.map(key => {
                            const def = PROVIDER_COL_DEFS[key];
                            const isDragging = draggingCol === key;
                            const isDragOver = dragOverCol === key;
                            const isCenterCol = key === 'quantity' || key === 'manufactured_at';
                            return (
                              <th
                                key={key}
                                draggable
                                onDragStart={() => handleColDragStart(key)}
                                onDragEnd={handleColDragEnd}
                                onDragOver={e => handleColDragOver(e, key)}
                                onDragLeave={() => setDragOverCol(null)}
                                onDrop={() => handleColDrop(key)}
                                className={[isDragging ? 'col-dragging' : '', isDragOver ? 'col-drag-over' : ''].filter(Boolean).join(' ')}
                                title={`${def.label} — drag to reorder`}
                                style={{ textAlign: isCenterCol ? 'center' : undefined, cursor: 'grab' }}
                              >
                                {def.label}
                              </th>
                            );
                          })}
                          {/* Delete header — fixed, not draggable */}
                          <th style={{ textAlign: 'center', color: 'var(--danger)' }}>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product, idx) => {
                          const isEditingThisRow = isBulkEditing || editingIds.includes(product.id);
                          const isSelected = selectedIds.includes(product.id);
                          const rowClasses = [
                            isEditingThisRow ? 'editing-row' : '',
                            isSelected ? 'spreadsheet-row-selected' : '',
                            Number(product.quantity) < 2 ? 'low-stock-row' : ''
                          ].filter(Boolean).join(' ');

                          /* renderCell: returns the correct <td> for a given column key */
                          const renderCell = (key) => {
                            if (isEditingThisRow) {
                              /* ── EDITING cells ── */
                              switch (key) {
                                case 'department':
                                  return (
                                    <td key={key}>
                                      <input className="inline-edit-input" list="provider-department-list" placeholder="Dept"
                                        value={editDataMap[product.id]?.department ?? ''}
                                        onChange={e => handleBulkEditChange(product.id, 'department', e.target.value)} />
                                    </td>
                                  );
                                case 'category':
                                  return <td key={key}>{editInput(product.id, 'category')}</td>;
                                case 'brand':
                                  return <td key={key}>{editInput(product.id, 'brand')}</td>;
                                case 'model_number':
                                  return <td key={key}>{editInput(product.id, 'model_number')}</td>;
                                case 'serial_number':
                                  return <td key={key}>{editInput(product.id, 'serial_number')}</td>;
                                case 'manufactured_at': {
                                  const raw = editDataMap[product.id]?.manufactured_at;
                                  const normalized = !raw ? 'No' : (() => { const s = String(raw).trim().toLowerCase(); return (s === 'yes' || s === 'true' || s === 'y') ? 'Yes' : (s === 'no' || s === 'false' || s === 'n') ? 'No' : raw; })();
                                  return (
                                    <td key={key}>
                                      <select className="inline-edit-input" value={normalized} onChange={e => handleBulkEditChange(product.id, 'manufactured_at', e.target.value)}>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                      </select>
                                    </td>
                                  );
                                }
                                case 'part_category': {
                                  const raw = editDataMap[product.id]?.part_category;
                                  const normalized = !raw ? 'Spare Part' : (() => { const s = String(raw).trim().toLowerCase(); return (s === 'complete set' || s === 'completeset') ? 'Complete Set' : 'Spare Part'; })();
                                  return (
                                    <td key={key}>
                                      <select className="inline-edit-input" value={normalized} onChange={e => handleBulkEditChange(product.id, 'part_category', e.target.value)}>
                                        <option value="Spare Part">Spare Part</option>
                                        <option value="Complete Set">Complete Set</option>
                                      </select>
                                    </td>
                                  );
                                }
                                case 'product_name':
                                  return (
                                    <td key={key}>
                                      <input className="inline-edit-input" placeholder="Enter part name"
                                        value={editDataMap[product.id]?.product_name ?? ''}
                                        onChange={e => handleBulkEditChange(product.id, 'product_name', e.target.value)} />
                                    </td>
                                  );
                                case 'part_number':
                                  return <td key={key}>{editInput(product.id, 'part_number')}</td>;
                                case 'location':
                                  return <td key={key}>{editInput(product.id, 'location')}</td>;
                                case 'quantity':
                                  return <td key={key}>{editInput(product.id, 'quantity', { width: '55px', textAlign: 'center' })}</td>;
                                case 'service_type':
                                  return (
                                    <td key={key}>
                                      <select className="inline-edit-input" value={editDataMap[product.id]?.service_type || 'Supply'} onChange={e => handleBulkEditChange(product.id, 'service_type', e.target.value)}>
                                        <option value="Supply">Supply</option>
                                        <option value="Supply and Service">Supply and Service</option>
                                      </select>
                                    </td>
                                  );
                                case 'payment_mode':
                                  return (
                                    <td key={key}>
                                      <select className="inline-edit-input" value={editDataMap[product.id]?.payment_mode || 'pre-payment'} onChange={e => handleBulkEditChange(product.id, 'payment_mode', e.target.value)}>
                                        <option value="pre-payment">pre-payment</option>
                                        <option value="credit">credit</option>
                                      </select>
                                    </td>
                                  );
                                case 'equipment_condition':
                                  return (
                                    <td key={key}>
                                      <select className="inline-edit-input" value={editDataMap[product.id]?.equipment_condition || 'New'} onChange={e => handleBulkEditChange(product.id, 'equipment_condition', e.target.value)}>
                                        <option value="New">New</option>
                                        <option value="Refurbished">Refurbished</option>
                                      </select>
                                    </td>
                                  );
                                case 'warranty':
                                  return <td key={key}>{editInput(product.id, 'warranty', { width: '85px' })}</td>;
                                default:
                                  return <td key={key}>—</td>;
                              }
                            } else {
                              /* ── DISPLAY cells ── */
                              switch (key) {
                                case 'department':
                                  return (
                                    <td key={key}>
                                      <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'4px', fontSize:'0.75rem', fontWeight:600, background:'#e0e7ff', color:'#3730a3' }}>
                                        {highlightText(product.department || 'General', searchQuery)}
                                      </span>
                                    </td>
                                  );
                                case 'category':
                                  return <td key={key}>{highlightText(product.category, searchQuery)}</td>;
                                case 'brand':
                                  return <td key={key}>{highlightText(product.brand, searchQuery)}</td>;
                                case 'model_number':
                                  return <td key={key}>{highlightText(product.model_number, searchQuery)}</td>;
                                case 'serial_number':
                                  return <td key={key} style={{ fontWeight: 500 }}>{highlightText(product.serial_number || '—', searchQuery)}</td>;
                                case 'manufactured_at': {
                                  const val = product.manufactured_at;
                                  const s = String(val || '').trim().toLowerCase();
                                  const isYes = s === 'yes' || s === 'true' || s === 'y';
                                  const isNo = s === 'no' || s === 'false' || s === 'n';
                                  return (
                                    <td key={key} style={{ textAlign: 'center' }}>
                                      {isYes ? <span style={{ color:'#16a34a', fontWeight:600, background:'rgba(22,163,74,0.1)', padding:'0.15rem 0.5rem', borderRadius:'4px' }}>Yes</span>
                                        : (isNo || !val) ? <span style={{ color:'#64748b', background:'rgba(100,116,139,0.1)', padding:'0.15rem 0.5rem', borderRadius:'4px' }}>No</span>
                                        : highlightText(product.manufactured_at, searchQuery)}
                                    </td>
                                  );
                                }
                                case 'part_category':
                                  return (
                                    <td key={key}>
                                      <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'4px', fontSize:'0.78rem', fontWeight:600, background:(product.part_category==='Complete Set')?'rgba(59,130,246,0.12)':'rgba(16,185,129,0.12)', color:(product.part_category==='Complete Set')?'#2563eb':'#059669' }}>
                                        {highlightText(product.part_category || 'Spare Part', searchQuery)}
                                      </span>
                                    </td>
                                  );
                                case 'product_name':
                                  return <td key={key} className="part-name-cell" style={{ fontWeight:600 }} title={product.product_name || ''}>{highlightText(product.product_name, searchQuery)}</td>;
                                case 'part_number':
                                  return <td key={key}>{highlightText(product.part_number, searchQuery)}</td>;
                                case 'location':
                                  return <td key={key}><span className="location-cell" title={product.location || ''}>{highlightText(product.location, searchQuery)}</span></td>;
                                case 'quantity':
                                  return <td key={key} style={{ textAlign:'center', color:Number(product.quantity)<2?'#ef4444':'inherit', fontWeight:Number(product.quantity)<2?'bold':'normal' }}>{highlightText(product.quantity, searchQuery)}</td>;
                                case 'service_type':
                                  return <td key={key}>{highlightText(product.service_type || 'Supply', searchQuery)}</td>;
                                case 'payment_mode':
                                  return <td key={key}>{highlightText(product.payment_mode || 'pre-payment', searchQuery)}</td>;
                                case 'equipment_condition':
                                  return (
                                    <td key={key}>
                                      <span style={{ display:'inline-block', padding:'0.2rem 0.55rem', borderRadius:'4px', fontSize:'0.8rem', fontWeight:600, background:(product.equipment_condition==='Refurbished')?'rgba(234,179,8,0.15)':'rgba(34,197,94,0.15)', color:(product.equipment_condition==='Refurbished')?'#b45309':'#15803d' }}>
                                        {highlightText(product.equipment_condition || 'New', searchQuery)}
                                      </span>
                                    </td>
                                  );
                                case 'warranty':
                                  return <td key={key}>{highlightText(product.warranty || '—', searchQuery)}</td>;
                                default:
                                  return <td key={key}>—</td>;
                              }
                            }
                          };

                          return (
                          <tr
                            key={product.id}
                            className={rowClasses}
                            onClick={(e) => {
                              if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && !isEditingThisRow) {
                                handleSelect(product.id);
                              }
                            }}
                            onDoubleClick={() => startEditingRow(product)}
                          >
                            {/* Fixed row-number cell */}
                            <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                            {/* Dynamic columns in user-defined order */}
                            {columnOrder.map(key => renderCell(key))}
                            {/* Fixed delete cell */}
                            <td style={{ textAlign: 'center', backgroundColor: '#fee2e2' }}>
                              <button className="table-action-btn delete-btn"
                                onClick={e => { e.stopPropagation(); deleteProduct(product.id); }}
                                disabled={deleting} title="Delete row">Delete</button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                    <datalist id="provider-department-list">
                      {[...new Set(products.map(p => p.department).filter(Boolean))].map(dep => (
                        <option key={dep} value={dep} />
                      ))}
                    </datalist>
                  </div>

                  {/* Pagination Controls */}
                  {filteredProducts.length > itemsPerPage && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} items
                      </div>
                      <div className="pagination-controls">
                        <button
                          type="button"
                          className="pagination-btn"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                        {getPageNumbers(currentPage, totalPages).map((p, pIdx) => (
                          p === '...' ? (
                            <span key={`ellipsis-${pIdx}`} className="pagination-ellipsis">…</span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={`pagination-btn ${currentPage === p ? 'active' : ''}`}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </button>
                          )
                        ))}
                        <button
                          type="button"
                          className="pagination-btn"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status bar — like Excel's bottom bar */}
                  <div className="spreadsheet-statusbar">
                    <span>
                      {selectedIds.length > 0
                        ? `${selectedIds.length} row${selectedIds.length > 1 ? 's' : ''} selected`
                        : 'Click row to select · Double-click to edit'
                      }
                    </span>
                    <span>
                      Total Qty: {products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)}
                      {' · '}
                      {new Set(products.map(p => p.category)).size} categories
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Download Menu was here */}

            {/* ── Unsaved Changes Warning Modal ── */}
            {showUnsavedModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: '12px',
                  padding: '2rem 2.25rem',
                  maxWidth: '420px',
                  width: '90%',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  textAlign: 'center'
                }}>

                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    Unsaved Changes
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
                    You have edited {editingIds.length} row{editingIds.length > 1 ? 's' : ''} that haven't been saved yet.
                    Do you want to save your changes before leaving?
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={async () => { setShowUnsavedModal(false); await saveBulkEdits(); }}
                      disabled={saving}
                      style={{ minWidth: '110px' }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={cancelBulkEdits}
                      style={{ minWidth: '110px' }}
                    >
                      Discard
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowUnsavedModal(false)}
                      style={{ minWidth: '110px' }}
                    >
                      Keep Editing
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showUploadModal && (
              <UploadModal 
                onClose={() => setShowUploadModal(false)}
                onSuccess={(count, skipped, shouldClose = true) => {
                  fetchProfile(); // Always fetch to get new departments
                  if (shouldClose) {
                    setShowUploadModal(false);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
      {showIntelligence && <SellerIntelligenceModal token={token} onClose={() => setShowIntelligence(false)} />}
    </>
  );
}
