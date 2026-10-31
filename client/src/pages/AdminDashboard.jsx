import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { LineChart, BarChart, RankBars, SERIES } from '../components/MgmtCharts';
import { DataTable, StatusPill, termsColumn, termsFields, termsLogColumns, fmtDate, fmtDateTime, fmtNum, fmtCompact, fmtPct, timeAgo, greeting, delta } from '../components/MgmtUI';
import './ManagementDashboard.css';

const API = '/api';

const lastSeen = (d) => d ? timeAgo(d) : 'Never';
const Verified = ({ at }) => at
  ? <span className="mg-pill mg-pill-approved" title={`Verified ${fmtDateTime(at)}`}><span aria-hidden="true">✓</span>Verified</span>
  : <span className="mg-sub">Not verified</span>;

// Supply coverage = matching listings vs. vessels that carry the equipment
function CoveragePill({ listings, ships }) {
  if (!listings) return <span className="mg-pill mg-pill-rejected"><span aria-hidden="true">✕</span>No supply</span>;
  if (listings < ships) return <span className="mg-pill mg-pill-pending"><span aria-hidden="true">!</span>Low supply</span>;
  return <span className="mg-pill mg-pill-approved"><span aria-hidden="true">✓</span>Covered</span>;
}

// Permanently deletes a buyer/seller login and all of its data. The admin must type the
// username to confirm. Returns true when the account was deleted.
async function deleteAccount({ userId, username, authH }) {
  const typed = window.prompt(
    `Permanently delete @${username}?\n\nThis removes the login, profile, listings, fleet, parts, inquiries, searches and sessions. It cannot be undone.\n\nType the username to confirm:`
  );
  if (typed === null) return false;
  if (typed.trim().replace(/^@/, '') !== username) {
    toast.error('Username did not match — nothing was deleted.');
    return false;
  }
  try {
    const res = await axios.delete(`${API}/admin/users/${userId}`, authH);
    toast.success(res.data?.message || 'Account deleted.');
    return true;
  } catch (err) {
    toast.error(err.response?.data?.error || 'Failed to delete account.');
    return false;
  }
}

const canDelete = (role) => role !== 'admin' && role !== 'management';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [overview, setOverview] = useState(null);
  const [intel, setIntel] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [fleetParts, setFleetParts] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [users, setUsers] = useState([]);
  const [termsLog, setTermsLog] = useState([]);
  const [drawer, setDrawer] = useState(null); // { kind: 'buyer' | 'seller', id }

  const authH = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const fetchAll = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [ov, pi, b, s, fp, inq, u, tl] = await Promise.all([
        axios.get(`${API}/admin/overview`, authH),
        axios.get(`${API}/admin/parts-intelligence`, authH),
        axios.get(`${API}/admin/buyers`, authH),
        axios.get(`${API}/admin/sellers`, authH),
        axios.get(`${API}/admin/fleet-parts`, authH),
        axios.get(`${API}/admin/inquiries`, authH),
        axios.get(`${API}/admin/users`, authH),
        axios.get(`${API}/management/terms-acceptances`, authH),
      ]);
      // If the API isn't reachable, the host may answer with index.html (a string) instead of JSON.
      // Rendering that would crash the page into a blank screen, so fail loudly instead.
      if (typeof ov.data !== 'object' || ov.data === null) {
        throw new Error('API returned a non-JSON response. Is the backend running and reachable at /api?');
      }
      const list = (d) => (Array.isArray(d) ? d : []);
      setOverview(ov.data);
      setIntel(pi.data && typeof pi.data === 'object' ? pi.data : null);
      setBuyers(list(b.data));
      setSellers(list(s.data));
      setFleetParts(list(fp.data));
      setInquiries(list(inq.data));
      setUsers(list(u.data));
      setTermsLog(list(tl.data));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authH]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pendingCount = buyers.filter(b => b.status === 'pending').length + sellers.filter(s => s.status === 'pending').length;

  // ─── Column definitions ────────────────────────────────────────────────────────
  const buyerColumns = [
    { key: 'username', label: 'Buyer', render: b => <div><div className="mg-strong">@{b.username}</div><div className="mg-sub">{b.email}</div></div>, csv: b => b.username },
    { key: 'email', label: 'Email', render: b => b.email },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'country', label: 'Country', render: b => b.country || '—' },
    { key: 'ship_count', label: 'Vessels', align: 'right', render: b => fmtNum(b.ship_count) },
    { key: 'part_count', label: 'Parts on fleet', align: 'right', render: b => fmtNum(b.part_count) },
    { key: 'equipment_count', label: 'Equipment types', align: 'right', render: b => fmtNum(b.equipment_count) },
    { key: 'inquiry_count', label: 'Inquiries', align: 'right', render: b => fmtNum(b.inquiry_count) },
    { key: 'email_verified_at', label: 'Email', render: b => <Verified at={b.email_verified_at} />, csv: b => b.email_verified_at ? 'verified' : 'not verified', sortValue: b => b.email_verified_at ? 1 : 0 },
    { key: 'last_seen', label: 'Last seen', render: b => lastSeen(b.last_seen), sortValue: b => b.last_seen ? new Date(b.last_seen).getTime() : 0, csv: b => fmtDateTime(b.last_seen) },
    termsColumn,
    { key: 'status', label: 'Status', render: b => <StatusPill status={b.status} /> },
    { key: 'created_at', label: 'Registered', render: b => fmtDate(b.created_at), sortValue: b => new Date(b.created_at).getTime(), csv: b => fmtDate(b.created_at) },
  ];

  const sellerColumns = [
    { key: 'company_name', label: 'Company', render: s => <div><div className="mg-strong">{s.company_name}</div><div className="mg-sub">@{s.username}</div></div> },
    { key: 'contact_person', label: 'Contact', render: s => <div><div>{s.contact_person}</div><div className="mg-sub">{s.email}</div></div>, csv: s => `${s.contact_person} <${s.email}>` },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'country', label: 'Location', render: s => [s.city, s.country].filter(Boolean).join(', ') || '—' },
    { key: 'product_count', label: 'Listings', align: 'right', render: s => fmtNum(s.product_count) },
    { key: 'units', label: 'Units', align: 'right', render: s => fmtNum(s.units) },
    { key: 'inventory_value', label: 'Stock value', align: 'right', render: s => `$${fmtCompact(s.inventory_value)}` },
    { key: 'inquiry_count', label: 'Inquiries', align: 'right', render: s => fmtNum(s.inquiry_count) },
    { key: 'accept_rate', label: 'Accept rate', align: 'right', render: s => s.inquiry_count ? fmtPct(s.accepted_count / s.inquiry_count) : '—', sortValue: s => s.inquiry_count ? s.accepted_count / s.inquiry_count : -1, csv: s => s.inquiry_count ? fmtPct(s.accepted_count / s.inquiry_count) : '' },
    { key: 'last_seen', label: 'Last seen', render: s => lastSeen(s.last_seen), sortValue: s => s.last_seen ? new Date(s.last_seen).getTime() : 0, csv: s => fmtDateTime(s.last_seen) },
    termsColumn,
    { key: 'status', label: 'Status', render: s => <StatusPill status={s.status} /> },
    { key: 'created_at', label: 'Registered', render: s => fmtDate(s.created_at), sortValue: s => new Date(s.created_at).getTime(), csv: s => fmtDate(s.created_at) },
  ];

  const fleetColumns = [
    { key: 'equipment', label: 'Equipment', render: r => <span className="mg-strong">{r.equipment}</span> },
    { key: 'manufacturer', label: 'Manufacturer', render: r => r.manufacturer || '—' },
    { key: 'model', label: 'Model', render: r => r.model || '—' },
    { key: 'ship_name', label: 'Vessel', render: r => <div><div>{r.ship_name || '—'}</div><div className="mg-sub">{[r.ship_type, r.imo_number && `IMO ${r.imo_number}`].filter(Boolean).join(' · ')}</div></div> },
    { key: 'buyer_username', label: 'Buyer', render: r => <div><button className="mg-link" onClick={(e) => { e.stopPropagation(); setDrawer({ kind: 'buyer', id: r.buyer_id }); }}>@{r.buyer_username}</button><div className="mg-sub">{r.buyer_email}</div></div> },
    { key: 'buyer_country', label: 'Country', render: r => r.buyer_country || '—' },
    { key: 'created_at', label: 'Added', render: r => fmtDate(r.created_at), sortValue: r => new Date(r.created_at).getTime(), csv: r => fmtDate(r.created_at) },
  ];

  const inquiryColumns = [
    { key: 'id', label: 'ID', render: i => <span className="mg-mono">#{i.id}</span>, sortValue: i => i.id },
    { key: 'product_name', label: 'Product', render: i => <div><div className="mg-strong">{i.product_name || 'Product removed'}</div><div className="mg-sub">{[i.category, i.part_number].filter(Boolean).join(' · ') || '—'}</div></div> },
    { key: 'buyer_username', label: 'Buyer', render: i => <div><div>{i.buyer_username ? `@${i.buyer_username}` : '—'}</div><div className="mg-sub">{i.buyer_email}</div></div> },
    { key: 'vendor_company', label: 'Seller', render: i => <div><div>{i.vendor_company || '—'}</div><div className="mg-sub">{i.vendor_email}</div></div> },
    { key: 'target_price', label: 'Target price', align: 'right', render: i => i.target_price ? `$${fmtNum(Number(i.target_price))}` : '—', sortValue: i => Number(i.target_price) || 0 },
    { key: 'destination_location', label: 'Destination', render: i => i.destination_location || '—' },
    { key: 'vessel_name', label: 'Vessel', render: i => i.vessel_name || '—' },
    { key: 'status', label: 'Status', render: i => <StatusPill status={i.status} /> },
    { key: 'created_at', label: 'Created', render: i => fmtDateTime(i.created_at), sortValue: i => new Date(i.created_at).getTime(), csv: i => fmtDateTime(i.created_at) },
  ];

  const userColumns = [
    { key: 'username', label: 'Username', render: u => <div><div className="mg-strong">@{u.username}</div><div className="mg-sub">{u.company_name || ''}</div></div> },
    { key: 'role', label: 'Role', render: u => <span className="mg-type">{u.role === 'provider' ? 'seller' : u.role}</span> },
    { key: 'email', label: 'Email', render: u => u.email || '—' },
    { key: 'phone', label: 'Phone', render: u => u.phone || '—', sortable: false },
    { key: 'email_verified_at', label: 'Verified', render: u => <Verified at={u.email_verified_at} />, sortValue: u => u.email_verified_at ? 1 : 0, csv: u => u.email_verified_at ? 'verified' : 'not verified' },
    termsColumn,
    { key: 'status', label: 'Access', render: u => <StatusPill status={u.status} /> },
    { key: 'active_sessions', label: 'Online', align: 'right', render: u => u.active_sessions ? <span className="mg-pill mg-pill-approved"><span aria-hidden="true">●</span>{u.active_sessions}</span> : '—' },
    { key: 'last_seen', label: 'Last seen', render: u => lastSeen(u.last_seen), sortValue: u => u.last_seen ? new Date(u.last_seen).getTime() : 0, csv: u => fmtDateTime(u.last_seen) },
    { key: 'created_at', label: 'Created', render: u => fmtDate(u.created_at), sortValue: u => new Date(u.created_at).getTime(), csv: u => fmtDate(u.created_at) },
    { key: 'actions', label: '', sortable: false, csv: false, render: u => canDelete(u.role) ? (
      <button className="mg-btn mg-btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
        onClick={async (e) => { e.stopPropagation(); if (await deleteAccount({ userId: u.id, username: u.username, authH })) fetchAll(true); }}>
        Delete
      </button>
    ) : null },
  ];

  const nav = [
    { id: 'overview',     icon: '📊', label: 'Overview' },
    { id: 'intelligence', icon: '🧠', label: 'Parts Intelligence' },
    { id: 'buyers',       icon: '🚢', label: 'Buyers',        count: buyers.length },
    { id: 'sellers',      icon: '🏭', label: 'Sellers',       count: sellers.length },
    { id: 'fleet',        icon: '⚙️', label: 'Fleet Registry', count: fleetParts.length },
    { id: 'inquiries',    icon: '✉️', label: 'Inquiries',     count: inquiries.length },
    { id: 'users',        icon: '🔐', label: 'Users & Access', count: users.length },
    { id: 'terms',        icon: '📜', label: 'T&C Acceptances', count: termsLog.length },
  ];

  const subtitles = {
    overview: 'Complete view of marketplace accounts, fleets, supply and demand.',
    intelligence: 'What buyers have on their vessels, what they are asking for, and where supply falls short.',
    buyers: 'Every buyer with full contact details, fleet size and purchasing activity. Click a row for the full profile.',
    sellers: 'Every seller with contact details, inventory and inquiry performance. Click a row for listings.',
    fleet: 'Every part recorded on every buyer vessel — searchable and exportable.',
    inquiries: 'All inquiries with buyer and seller contact details.',
    users: 'All login accounts, verification state and session activity.',
    terms: 'Legal record of every Terms & Conditions acceptance — account, document version, exact time, IP address and device.',
  };

  if (loading) {
    return (
      <div className="mg-shell">
        <Navbar />
        <div className="mg-loading">
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
          <p>Loading admin panel…</p>
        </div>
      </div>
    );
  }

  const ov = overview || {};
  const pi = intel || { summary: {}, topEquipment: [], supplyGaps: [], topManufacturers: [], topModels: [], shipTypes: [], trendingProducts: [], risingEquipment: [], partsTrend: [], inquiryCategories: [] };
  const sm = pi.summary || {};
  const signupDelta = ov.signups30d ? delta(ov.signups30d.current, ov.signups30d.previous) : null;
  const inquiryDelta = ov.inquiries30d ? delta(ov.inquiries30d.current, ov.inquiries30d.previous) : null;
  const onlineNow = users.reduce((n, u) => n + (u.active_sessions ? 1 : 0), 0);

  const kpis = [
    { label: 'Total accounts', value: fmtNum(users.length), sub: `${fmtNum(buyers.length)} buyers · ${fmtNum(sellers.length)} sellers`, delta: signupDelta },
    { label: 'Pending approval', value: fmtNum(pendingCount), sub: 'Buyers & sellers awaiting review', tone: pendingCount ? 'warn' : null },
    { label: 'Vessels registered', value: fmtNum(sm.ships), sub: `${fmtNum(sm.buyers_with_fleet)} buyers with a fleet` },
    { label: 'Parts on fleets', value: fmtNum(sm.parts), sub: `${fmtNum(sm.equipment_types)} equipment types`, action: () => setSection('fleet') },
    { label: 'Catalogue', value: fmtNum(ov.catalog?.products), sub: `${fmtCompact(ov.catalog?.units)} units · $${fmtCompact(ov.catalog?.inventoryValue)} value` },
    { label: 'Inquiries (30d)', value: fmtNum(ov.inquiries30d?.current), sub: `${fmtPct(ov.responseRate)} seller response rate`, delta: inquiryDelta },
    { label: 'Supply gaps', value: fmtNum(pi.supplyGaps.length), sub: 'Fleet equipment with no listings', tone: pi.supplyGaps.length ? 'warn' : null, action: () => setSection('intelligence') },
    { label: 'Online now', value: fmtNum(onlineNow), sub: 'Users with an active session', action: () => setSection('users') },
  ];

  const equipmentTable = (rows, { compact = false } = {}) => (
    <div className="mg-table-wrap">
      <table className={`mg-table ${compact ? 'mg-table-compact' : ''}`}>
        <thead>
          <tr>
            <th>Equipment</th>
            <th style={{ textAlign: 'right' }}>Vessels</th>
            <th style={{ textAlign: 'right' }}>Buyers</th>
            {!compact && <th style={{ textAlign: 'right' }}>Records</th>}
            {!compact && <th style={{ textAlign: 'right' }}>Makers</th>}
            <th style={{ textAlign: 'right' }}>Listings</th>
            {!compact && <th style={{ textAlign: 'right' }}>Units</th>}
            <th>Supply</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="mg-empty">No fleet parts recorded yet.</td></tr>
          ) : rows.map(e => (
            <tr key={e.k || e.label}>
              <td><span className="mg-strong">{e.label}</span></td>
              <td style={{ textAlign: 'right' }}>{fmtNum(e.ships)}</td>
              <td style={{ textAlign: 'right' }}>{fmtNum(e.buyers)}</td>
              {!compact && <td style={{ textAlign: 'right' }}>{fmtNum(e.records)}</td>}
              {!compact && <td style={{ textAlign: 'right' }}>{fmtNum(e.manufacturers)}</td>}
              <td style={{ textAlign: 'right' }}>{fmtNum(e.listings)}</td>
              {!compact && <td style={{ textAlign: 'right' }}>{fmtNum(e.units)}</td>}
              <td><CoveragePill listings={e.listings} ships={e.ships} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mg-shell">
      <Navbar />
      <div className="mg-layout">
        <aside className="mg-sidebar">
          <div className="mg-sidebar-title">Admin Panel</div>
          <nav>
            {nav.map(n => (
              <button key={n.id} className={`mg-nav ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
                <span className="mg-nav-icon" aria-hidden="true">{n.icon}</span>
                <span>{n.label}</span>
                {n.count !== undefined && <span className="mg-nav-count">{fmtNum(n.count)}</span>}
              </button>
            ))}
          </nav>
          <div className="mg-sidebar-foot">
            <div className="mg-online"><span className="mg-online-dot" />{fmtNum(onlineNow)} users online now</div>
          </div>
        </aside>

        <main className="mg-main">
          <header className="mg-header">
            <div>
              <div className="mg-eyebrow">🔒 Restricted · admin only</div>
              <h1 className="mg-title">{section === 'overview' ? `${greeting()}, ${user?.username || 'Admin'}` : nav.find(n => n.id === section)?.label}</h1>
              <p className="mg-subtitle">{subtitles[section]}</p>
            </div>
            <div className="mg-header-actions">
              {lastUpdated && <span className="mg-updated">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button className="mg-btn mg-btn-ghost" onClick={() => fetchAll(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
            </div>
          </header>

          {/* ══ OVERVIEW ══ */}
          {section === 'overview' && (
            <>
              {pendingCount > 0 && (
                <div className="mg-alert">
                  <span className="mg-alert-icon" aria-hidden="true">🛡️</span>
                  <div><strong>{pendingCount} account{pendingCount > 1 ? 's' : ''} awaiting approval.</strong><span> Open a buyer or seller to approve or reject, or use the Pending filter.</span></div>
                  <button className="mg-btn mg-btn-primary" onClick={() => setSection(buyers.some(b => b.status === 'pending') ? 'buyers' : 'sellers')}>Review</button>
                </div>
              )}

              <section className="mg-kpis">
                {kpis.map(k => (
                  <div key={k.label} className={`mg-card mg-kpi ${k.tone ? `mg-kpi-${k.tone}` : ''} ${k.action ? 'clickable' : ''}`} onClick={k.action || undefined}>
                    <div className="mg-kpi-label">{k.label}</div>
                    <div className="mg-kpi-value">{k.value}</div>
                    {k.delta && <div className={`mg-delta mg-delta-${k.delta.dir}`}>{k.delta.dir === 'up' ? '▲' : k.delta.dir === 'down' ? '▼' : '•'} {k.delta.text}</div>}
                    <div className="mg-kpi-sub">{k.sub}</div>
                  </div>
                ))}
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Most demanded equipment</h3><button className="mg-link" onClick={() => setSection('intelligence')}>Full analysis →</button></div>
                  {equipmentTable(pi.topEquipment.slice(0, 8), { compact: true })}
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Top manufacturers on fleets</h3><span className="mg-card-meta">By vessels</span></div>
                  <RankBars items={pi.topManufacturers.slice(0, 8)} labelKey="label" valueKey="ships" />
                </div>
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>New registrations</h3><span className="mg-card-meta">Last 30 days</span></div>
                  <LineChart data={ov.signupTrend || []} series={[{ key: 'buyers', label: 'Buyers', color: SERIES[0] }, { key: 'sellers', label: 'Sellers', color: SERIES[1] }]} />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Recent activity</h3></div>
                  {(ov.recentActivity || []).length === 0 ? <div className="mg-empty-sm">No activity yet</div> : (
                    <ul className="mg-feed">
                      {ov.recentActivity.slice(0, 7).map((a, i) => (
                        <li key={i}>
                          <span className="mg-avatar" aria-hidden="true">{{ buyer_registered: '🚢', seller_registered: '🏭', inquiry: '✉️' }[a.type]}</span>
                          <div className="mg-feed-text">
                            {a.type === 'inquiry' ? <><strong>@{a.actor || 'buyer'}</strong> inquired for <strong>{a.detail}</strong></> : <><strong>{a.type === 'buyer_registered' ? `@${a.actor}` : a.actor}</strong> registered as a {a.type === 'buyer_registered' ? 'buyer' : 'seller'}</>}
                          </div>
                          <span className="mg-feed-time">{timeAgo(a.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ══ PARTS INTELLIGENCE ══ */}
          {section === 'intelligence' && (
            <>
              <section className="mg-kpis">
                {[
                  ['Vessels', sm.ships], ['Parts recorded', sm.parts], ['Equipment types', sm.equipment_types],
                  ['Buyers with fleet', sm.buyers_with_fleet], ['Inquiries (30d)', sm.inquiries_30d], ['Product searches (7d)', sm.searches_7d],
                ].map(([label, value]) => (
                  <div key={label} className="mg-card mg-kpi" style={{ minHeight: 0 }}>
                    <div className="mg-kpi-label">{label}</div>
                    <div className="mg-kpi-value">{fmtNum(value)}</div>
                  </div>
                ))}
              </section>

              <section className="mg-card mg-table-card" style={{ marginBottom: '1rem' }}>
                <div className="mg-card-head" style={{ padding: '1.1rem 1.35rem 0' }}>
                  <h3>Demand vs. supply — equipment installed on buyer vessels</h3>
                  <span className="mg-card-meta">Ranked by number of vessels</span>
                </div>
                <p className="mg-sub" style={{ padding: '0 1.35rem 0.75rem', margin: 0 }}>
                  "Listings" counts catalogue products whose name or category matches the equipment. <strong>No supply</strong> and <strong>Low supply</strong> are sourcing opportunities to share with sellers.
                </p>
                {equipmentTable(pi.topEquipment)}
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Trending products</h3><span className="mg-card-meta">Inquiries last 30d · searches last 7d</span></div>
                  {pi.trendingProducts.length === 0 ? <div className="mg-empty-sm">No inquiries or searches in the last 30 days yet.</div> : (
                    <div className="mg-table-wrap">
                      <table className="mg-table mg-table-compact">
                        <thead><tr><th>Product</th><th>Seller</th><th style={{ textAlign: 'right' }}>Inquiries</th><th style={{ textAlign: 'right' }}>Trend</th><th style={{ textAlign: 'right' }}>Buyers</th><th style={{ textAlign: 'right' }}>Searches</th></tr></thead>
                        <tbody>
                          {pi.trendingProducts.map(p => {
                            const d = delta(p.inquiries_30d, p.inquiries_prev);
                            return (
                              <tr key={p.id}>
                                <td><div className="mg-strong">{p.product_name}</div><div className="mg-sub">{[p.brand, p.part_number].filter(Boolean).join(' · ') || p.category}</div></td>
                                <td>{p.company_name}</td>
                                <td style={{ textAlign: 'right' }}>{fmtNum(p.inquiries_30d)}</td>
                                <td style={{ textAlign: 'right' }}><span className={`mg-delta mg-delta-${d.dir}`}>{d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '•'} {d.text.replace(' vs prev. 30d', '')}</span></td>
                                <td style={{ textAlign: 'right' }}>{fmtNum(p.buyers)}</td>
                                <td style={{ textAlign: 'right' }}>{fmtNum(p.searches_7d)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Supply gaps</h3><span className="mg-card-meta">On fleets, not listed</span></div>
                  {pi.supplyGaps.length === 0 ? <div className="mg-empty-sm">✓ Every fleet equipment type has at least one listing.</div> : (
                    <RankBars items={pi.supplyGaps} labelKey="label" valueKey="ships" color={SERIES[1]} format={(v) => `${v} vessel${v === 1 ? '' : 's'}`} />
                  )}
                </div>
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Most common models on fleets</h3><span className="mg-card-meta">Equipment · maker · model</span></div>
                  {pi.topModels.length === 0 ? <div className="mg-empty-sm">No model data recorded yet.</div> : (
                    <div className="mg-table-wrap">
                      <table className="mg-table mg-table-compact">
                        <thead><tr><th>Model</th><th>Equipment</th><th>Manufacturer</th><th style={{ textAlign: 'right' }}>Vessels</th><th style={{ textAlign: 'right' }}>Buyers</th></tr></thead>
                        <tbody>
                          {pi.topModels.map((m, i) => (
                            <tr key={i}>
                              <td className="mg-strong">{m.model}</td><td>{m.equipment}</td><td>{m.manufacturer || '—'}</td>
                              <td style={{ textAlign: 'right' }}>{fmtNum(m.ships)}</td><td style={{ textAlign: 'right' }}>{fmtNum(m.buyers)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Rising in fleets</h3><span className="mg-card-meta">Parts added, last 30 days</span></div>
                  <RankBars items={pi.risingEquipment} labelKey="label" valueKey="added" />
                </div>
              </section>

              <section className="mg-grid mg-grid-3">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Top manufacturers</h3><span className="mg-card-meta">By vessels</span></div>
                  <RankBars items={pi.topManufacturers} labelKey="label" valueKey="ships" />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Fleet by vessel type</h3><span className="mg-card-meta">Vessels</span></div>
                  <RankBars items={pi.shipTypes} labelKey="ship_type" valueKey="ships" />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Inquiry demand by category</h3><span className="mg-card-meta">All-time</span></div>
                  <RankBars items={pi.inquiryCategories} labelKey="category" />
                </div>
              </section>

              <section className="mg-card">
                <div className="mg-card-head"><h3>Parts recorded on fleets</h3><span className="mg-card-meta">Daily · last 30 days</span></div>
                <BarChart data={pi.partsTrend} label="Parts added" />
              </section>
            </>
          )}

          {section === 'buyers' && (
            <DataTable rows={buyers} columns={buyerColumns} searchKeys={['username', 'email', 'phone', 'country', 'imo_number', 'ship_name']}
              statusOptions={['approved', 'pending', 'rejected']} onRowClick={(r) => setDrawer({ kind: 'buyer', id: r.id })} exportName="buyers-full" />
          )}

          {section === 'sellers' && (
            <DataTable rows={sellers} columns={sellerColumns} searchKeys={['company_name', 'username', 'contact_person', 'email', 'phone', 'country', 'city', 'address']}
              statusOptions={['approved', 'pending', 'rejected']} onRowClick={(r) => setDrawer({ kind: 'seller', id: r.id })} exportName="sellers-full" />
          )}

          {section === 'fleet' && (
            <DataTable rows={fleetParts} columns={fleetColumns} searchKeys={['equipment', 'manufacturer', 'model', 'ship_name', 'imo_number', 'buyer_username', 'buyer_email', 'buyer_country']}
              onRowClick={(r) => setDrawer({ kind: 'buyer', id: r.buyer_id })} exportName="fleet-parts" emptyText="No parts recorded on buyer vessels yet." />
          )}

          {section === 'inquiries' && (
            <DataTable rows={inquiries} columns={inquiryColumns} searchKeys={['id', 'product_name', 'part_number', 'category', 'buyer_username', 'buyer_email', 'vendor_company', 'vendor_email', 'destination_location', 'vessel_name']}
              statusOptions={['pending', 'accepted', 'rejected']} exportName="inquiries-full" emptyText="No inquiries yet." />
          )}

          {section === 'terms' && (
            <DataTable
              rows={termsLog}
              columns={termsLogColumns}
              searchKeys={['username', 'email', 'company_name', 'terms_version', 'ip_address', 'role']}
              statusKey="role"
              statusOptions={['buyer', 'seller']}
              defaultSort="accepted_at"
              exportName="terms-acceptances"
              emptyText="No acceptances recorded yet. New registrations will appear here."
            />
          )}

          {section === 'users' && (
            <DataTable rows={users} columns={userColumns} searchKeys={['username', 'email', 'phone', 'company_name', 'role']}
              statusKey="role" statusOptions={['buyer', 'seller', 'provider', 'management', 'admin']} exportName="users" />
          )}
        </main>
      </div>

      {drawer && (
        <AdminDetailDrawer
          kind={drawer.kind}
          id={drawer.id}
          authH={authH}
          onClose={() => setDrawer(null)}
          onChanged={() => fetchAll(true)}
          onDeleted={() => { setDrawer(null); fetchAll(true); }}
        />
      )}
    </div>
  );
}

// ─── Full buyer / seller profile ──────────────────────────────────────────────────
function AdminDetailDrawer({ kind, id, authH, onClose, onChanged, onDeleted }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openShip, setOpenShip] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/${kind === 'buyer' ? 'buyers' : 'sellers'}/${id}`, authH);
      setData(res.data);
      setOpenShip(res.data.fleet?.[0]?.id ?? null);
    } catch {
      toast.error('Failed to load details.');
      onClose();
    }
  }, [kind, id, authH, onClose]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const decide = async (decision, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await axios.put(`${API}/management/${kind === 'buyer' ? 'buyers' : 'sellers'}/${id}/${decision}`, {}, authH);
      toast.success(`Account ${decision === 'approve' ? 'approved' : 'rejected'} — notification email sent.`);
      await load();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    const deleted = await deleteAccount({ userId: p.user_id, username: p.username, authH });
    setBusy(false);
    if (deleted) onDeleted();
  };

  const p = data?.profile;
  const name = p ? (kind === 'seller' ? p.company_name : `@${p.username}`) : '…';

  const fields = !p ? [] : kind === 'seller'
    ? [['Username', `@${p.username}`], ['Contact person', p.contact_person], ['Email', p.email], ['Email verified', p.email_verified_at ? fmtDateTime(p.email_verified_at) : 'No'],
       ['Phone', p.phone], ['Address', p.address], ['City', p.city], ['Country', p.country], ['Company type', p.description],
       ['Payment mode', p.payment_mode], ['Registered', fmtDateTime(p.created_at)], ['Last reviewed', fmtDateTime(p.reviewed_at)], ['Last seen', p.last_seen ? fmtDateTime(p.last_seen) : 'Never'], ...termsFields(p)]
    : [['Username', `@${p.username}`], ['Email', p.email], ['Email verified', p.email_verified_at ? fmtDateTime(p.email_verified_at) : 'No'], ['Phone', p.phone],
       ['Country', p.country], ['IMO (profile)', p.imo_number], ['Ship (profile)', p.ship_name], ['Registered', fmtDateTime(p.created_at)],
       ['Last reviewed', fmtDateTime(p.reviewed_at)], ['Last seen', p.last_seen ? fmtDateTime(p.last_seen) : 'Never'], ...termsFields(p)];

  const totalParts = data?.fleet ? data.fleet.reduce((n, s) => n + s.parts.length, 0) + (data.unassignedParts?.length || 0) : 0;

  return (
    <div className="mg-drawer-backdrop" onClick={onClose}>
      <aside className="mg-drawer" style={{ width: 'min(720px, 100%)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${name} details`}>
        <div className="mg-drawer-head">
          <div>
            <div className="mg-eyebrow">{kind === 'seller' ? 'Seller account' : 'Buyer account'} · full profile</div>
            <h2>{name}</h2>
            {p?.status && <StatusPill status={p.status} />}
          </div>
          <button className="mg-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!data ? (
          <div className="mg-loading" style={{ minHeight: 240 }}><div className="spinner"></div></div>
        ) : (
          <div style={{ flex: 1 }}>
            <dl className="mg-dl">
              {fields.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? '—' : value}</dd></div>
              ))}
            </dl>

            {kind === 'buyer' && (
              <div style={{ padding: '0.5rem 1.5rem 1rem' }}>
                <h3 className="mg-drawer-section">Fleet · {data.fleet.length} vessel{data.fleet.length === 1 ? '' : 's'} · {totalParts} parts</h3>
                {data.fleet.length === 0 && <div className="mg-empty-sm">No vessels registered.</div>}
                {data.fleet.map(ship => (
                  <div key={ship.id} className="mg-ship">
                    <button className="mg-ship-head" onClick={() => setOpenShip(openShip === ship.id ? null : ship.id)} aria-expanded={openShip === ship.id}>
                      <span aria-hidden="true">{openShip === ship.id ? '▾' : '▸'}</span>
                      <span className="mg-strong">{ship.ship_name}</span>
                      <span className="mg-sub">{[ship.ship_type, ship.imo_number && `IMO ${ship.imo_number}`].filter(Boolean).join(' · ')}</span>
                      <span className="mg-chip-count" style={{ marginLeft: 'auto' }}>{ship.parts.length} parts</span>
                    </button>
                    {openShip === ship.id && (
                      ship.parts.length === 0 ? <div className="mg-empty-sm">No parts recorded on this vessel.</div> : (
                        <table className="mg-table mg-table-compact" style={{ margin: '0 0 0.5rem' }}>
                          <thead><tr><th>Equipment</th><th>Manufacturer</th><th>Model</th></tr></thead>
                          <tbody>
                            {ship.parts.map(pt => <tr key={pt.id}><td className="mg-strong">{pt.equipment}</td><td>{pt.manufacturer || '—'}</td><td>{pt.model || '—'}</td></tr>)}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                ))}

                <h3 className="mg-drawer-section">Inquiries sent · {data.inquiries.length}</h3>
                {data.inquiries.length === 0 ? <div className="mg-empty-sm">No inquiries yet.</div> : (
                  <table className="mg-table mg-table-compact">
                    <thead><tr><th>Product</th><th>Seller</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>{data.inquiries.map(i => <tr key={i.id}><td>{i.product_name || '—'}</td><td>{i.seller_company || '—'}</td><td><StatusPill status={i.status} /></td><td>{fmtDate(i.created_at)}</td></tr>)}</tbody>
                  </table>
                )}

                {data.searches.length > 0 && (
                  <>
                    <h3 className="mg-drawer-section">Recent searches</h3>
                    <ul className="mg-mini-list">
                      {data.searches.map((s, i) => <li key={i}><div className="mg-mini-main"><div>{s.product_name || s.search_query}</div><div className="mg-sub">{s.search_query ? `"${s.search_query}" · ` : ''}{timeAgo(s.created_at)}</div></div></li>)}
                    </ul>
                  </>
                )}
              </div>
            )}

            {kind === 'seller' && (
              <div style={{ padding: '0.5rem 1.5rem 1rem' }}>
                <h3 className="mg-drawer-section">Listings · {data.products.length}</h3>
                {data.products.length === 0 ? <div className="mg-empty-sm">No products listed.</div> : (
                  <div className="mg-table-wrap">
                    <table className="mg-table mg-table-compact">
                      <thead><tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Inquiries</th></tr></thead>
                      <tbody>
                        {data.products.map(pr => (
                          <tr key={pr.id}>
                            <td><div className="mg-strong">{pr.product_name}</div><div className="mg-sub">{[pr.brand, pr.part_number, pr.equipment_condition].filter(Boolean).join(' · ')}</div></td>
                            <td>{pr.category || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{fmtNum(pr.quantity)}</td>
                            <td style={{ textAlign: 'right' }}>${fmtNum(Number(pr.price))}</td>
                            <td style={{ textAlign: 'right' }}>{fmtNum(pr.inquiry_count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="mg-drawer-section">Inquiries received · {data.inquiries.length}</h3>
                {data.inquiries.length === 0 ? <div className="mg-empty-sm">No inquiries yet.</div> : (
                  <table className="mg-table mg-table-compact">
                    <thead><tr><th>Product</th><th>Buyer</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>{data.inquiries.map(i => <tr key={i.id}><td>{i.product_name || '—'}</td><td>{i.buyer_username ? `@${i.buyer_username}` : '—'}<div className="mg-sub">{i.buyer_email}</div></td><td><StatusPill status={i.status} /></td><td>{fmtDate(i.created_at)}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {p && (
          <div className="mg-drawer-actions">
            <button className="mg-btn mg-btn-danger" style={{ marginRight: 'auto' }} disabled={busy} onClick={removeAccount}>🗑 Delete account &amp; data</button>
            {p.status === 'pending' && (
              <>
                <button className="mg-btn mg-btn-danger" disabled={busy} onClick={() => decide('reject', `Reject ${name}? They will be notified by email.`)}>Reject</button>
                <button className="mg-btn mg-btn-success" disabled={busy} onClick={() => decide('approve')}>Approve account</button>
              </>
            )}
            {p.status === 'approved' && (
              <button className="mg-btn mg-btn-danger" disabled={busy} onClick={() => decide('reject', `Revoke access for ${name}? They will be signed out immediately and notified by email.`)}>Revoke access</button>
            )}
            {p.status === 'rejected' && (
              <button className="mg-btn mg-btn-success" disabled={busy} onClick={() => decide('approve', `Reinstate ${name}? They will be able to sign in again.`)}>Reinstate account</button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
