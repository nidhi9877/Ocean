import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { LineChart, BarChart, RankBars, Sparkline, SERIES } from '../components/MgmtCharts';
import { DataTable, StatusPill, termsColumn, termsFields, termsLogColumns, STATUS_META, fmtDate, fmtDateTime, fmtNum, fmtCompact, fmtPct, hoursSince, timeAgo, greeting, delta } from '../components/MgmtUI';
import './ManagementDashboard.css';

const API = '/api';
const APPROVAL_SLA_HOURS = 24;

// ─── Main page ───────────────────────────────────────────────────────────────────
export default function ManagementDashboard() {
  const { token, user } = useAuth();
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busy, setBusy] = useState(new Set());

  const [overview, setOverview] = useState(null);
  const [pendingSellers, setPendingSellers] = useState([]);
  const [pendingBuyers, setPendingBuyers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [termsLog, setTermsLog] = useState([]);

  const [drawer, setDrawer] = useState(null); // { kind: 'seller' | 'buyer', record }
  const [queueFilter, setQueueFilter] = useState('all');
  const [queueQuery, setQueueQuery] = useState('');
  const [selected, setSelected] = useState(new Set());

  const authH = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const fetchAll = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [ov, ps, pb, s, b, inq, tl] = await Promise.all([
        axios.get(`${API}/management/overview`, authH),
        axios.get(`${API}/management/pending-sellers`, authH),
        axios.get(`${API}/management/pending-buyers`, authH),
        axios.get(`${API}/management/all-sellers`, authH),
        axios.get(`${API}/management/all-buyers`, authH),
        axios.get(`${API}/management/inquiries`, authH),
        axios.get(`${API}/management/terms-acceptances`, authH),
      ]);
      setOverview(ov.data);
      setPendingSellers(ps.data);
      setPendingBuyers(pb.data);
      setSellers(s.data);
      setBuyers(b.data);
      setInquiries(inq.data);
      setTermsLog(tl.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch management data:', err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authH]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Approval queue — buyers and sellers in one list, oldest request first (FIFO review)
  const queue = useMemo(() => [
    ...pendingSellers.map(s => ({ key: `seller:${s.id}`, kind: 'seller', id: s.id, name: s.company_name, username: s.username, email: s.email, phone: s.phone, country: s.country, created_at: s.created_at, detail: s.description, record: s })),
    ...pendingBuyers.map(b => ({ key: `buyer:${b.id}`, kind: 'buyer', id: b.id, name: b.username, username: b.username, email: b.email, phone: b.phone, country: b.country, created_at: b.created_at, detail: null, record: b })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [pendingSellers, pendingBuyers]);

  const visibleQueue = useMemo(() => {
    const q = queueQuery.trim().toLowerCase();
    return queue.filter(item =>
      (queueFilter === 'all' || item.kind === queueFilter) &&
      (!q || [item.name, item.username, item.email, item.country].some(v => String(v ?? '').toLowerCase().includes(q)))
    );
  }, [queue, queueFilter, queueQuery]);

  const overdueCount = queue.filter(i => hoursSince(i.created_at) > APPROVAL_SLA_HOURS).length;

  // ─── Actions ───────────────────────────────────────────────────────────────────
  const review = async (kind, id, decision, { silent = false } = {}) => {
    const key = `${kind}:${id}`;
    setBusy(prev => new Set(prev).add(key));
    try {
      await axios.put(`${API}/management/${kind === 'seller' ? 'sellers' : 'buyers'}/${id}/${decision}`, {}, authH);
      if (!silent) toast.success(`${kind === 'seller' ? 'Seller' : 'Buyer'} ${decision === 'approve' ? 'approved' : 'rejected'} — notification email sent.`);
      return true;
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || `Failed to ${decision} ${kind}.`);
      return false;
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const reviewOne = async (kind, id, decision, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (await review(kind, id, decision)) {
      setSelected(prev => { const n = new Set(prev); n.delete(`${kind}:${id}`); return n; });
      setDrawer(null);
      fetchAll(true);
    }
  };

  const reviewBulk = async (decision) => {
    const items = visibleQueue.filter(i => selected.has(i.key));
    if (items.length === 0) return;
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : 'Reject'} ${items.length} selected account${items.length > 1 ? 's' : ''}?`)) return;
    const results = await Promise.all(items.map(i => review(i.kind, i.id, decision, { silent: true })));
    const ok = results.filter(Boolean).length;
    ok && toast.success(`${ok} account${ok > 1 ? 's' : ''} ${decision === 'approve' ? 'approved' : 'rejected'}.`);
    ok < items.length && toast.error(`${items.length - ok} action${items.length - ok > 1 ? 's' : ''} failed.`);
    setSelected(new Set());
    fetchAll(true);
  };

  const toggleSelect = (key) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allVisibleSelected = visibleQueue.length > 0 && visibleQueue.every(i => selected.has(i.key));
  const toggleSelectAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visibleQueue.map(i => i.key)));

  // ─── Column definitions ────────────────────────────────────────────────────────
  const sellerColumns = [
    { key: 'company_name', label: 'Company', render: s => <div><div className="mg-strong">{s.company_name}</div><div className="mg-sub">@{s.username}</div></div> },
    { key: 'contact_person', label: 'Contact', render: s => <div><div>{s.contact_person}</div><div className="mg-sub">{s.email}</div></div>, csv: s => `${s.contact_person} <${s.email}>` },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'country', label: 'Country', render: s => [s.city, s.country].filter(Boolean).join(', ') || '—' },
    { key: 'product_count', label: 'Products', align: 'right', render: s => fmtNum(s.product_count) },
    { key: 'inquiry_count', label: 'Inquiries', align: 'right', render: s => fmtNum(s.inquiry_count) },
    termsColumn,
    { key: 'status', label: 'Status', render: s => <StatusPill status={s.status} /> },
    { key: 'created_at', label: 'Registered', render: s => fmtDate(s.created_at), sortValue: s => new Date(s.created_at).getTime(), csv: s => fmtDate(s.created_at) },
  ];

  const buyerColumns = [
    { key: 'username', label: 'Buyer', render: b => <div><div className="mg-strong">@{b.username}</div><div className="mg-sub">{b.email}</div></div> },
    { key: 'email', label: 'Email', render: b => b.email },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'country', label: 'Country', render: b => b.country || '—' },
    { key: 'ship_count', label: 'Vessels', align: 'right', render: b => fmtNum(b.ship_count) },
    { key: 'inquiry_count', label: 'Inquiries', align: 'right', render: b => fmtNum(b.inquiry_count) },
    termsColumn,
    { key: 'status', label: 'Status', render: b => <StatusPill status={b.status} /> },
    { key: 'created_at', label: 'Registered', render: b => fmtDate(b.created_at), sortValue: b => new Date(b.created_at).getTime(), csv: b => fmtDate(b.created_at) },
  ];

  const inquiryColumns = [
    { key: 'id', label: 'ID', render: i => <span className="mg-mono">#{i.id}</span>, sortValue: i => i.id },
    { key: 'product_name', label: 'Product', render: i => <div><div className="mg-strong">{i.product_name || 'Product removed'}</div><div className="mg-sub">{[i.brand, i.part_number].filter(Boolean).join(' · ') || '—'}</div></div> },
    { key: 'buyer_username', label: 'Buyer', render: i => i.buyer_username ? `@${i.buyer_username}` : '—' },
    { key: 'seller_company', label: 'Seller', render: i => i.seller_company || '—' },
    { key: 'destination_location', label: 'Destination', render: i => i.destination_location || '—' },
    { key: 'vessel_name', label: 'Vessel', render: i => i.vessel_name || '—' },
    { key: 'status', label: 'Status', render: i => <StatusPill status={i.status} /> },
    { key: 'created_at', label: 'Created', render: i => fmtDateTime(i.created_at), sortValue: i => new Date(i.created_at).getTime(), csv: i => fmtDateTime(i.created_at) },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────────
  const nav = [
    { id: 'overview',  icon: '📊', label: 'Overview' },
    { id: 'approvals', icon: '🛡️', label: 'Approvals', badge: queue.length },
    { id: 'sellers',   icon: '🏭', label: 'Sellers',   count: sellers.length },
    { id: 'buyers',    icon: '🚢', label: 'Buyers',    count: buyers.length },
    { id: 'inquiries', icon: '✉️', label: 'Inquiries', count: inquiries.length },
    { id: 'terms',     icon: '📜', label: 'T&C Acceptances', count: termsLog.length },
  ];

  if (loading) {
    return (
      <div className="mg-shell">
        <Navbar />
        <div className="mg-loading">
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
          <p>Loading management console…</p>
        </div>
      </div>
    );
  }

  const ov = overview || {};
  const signupDelta = ov.signups30d ? delta(ov.signups30d.current, ov.signups30d.previous) : null;
  const inquiryDelta = ov.inquiries30d ? delta(ov.inquiries30d.current, ov.inquiries30d.previous) : null;
  const signupSpark = (ov.signupTrend || []).map(d => d.buyers + d.sellers);
  const inquirySpark = (ov.inquiryTrend || []).map(d => d.count);

  const kpis = [
    { label: 'Registered accounts', value: fmtNum((ov.sellers?.total || 0) + (ov.buyers?.total || 0)), sub: `${fmtNum(ov.sellers?.total)} sellers · ${fmtNum(ov.buyers?.total)} buyers`, delta: signupDelta, spark: signupSpark },
    { label: 'Awaiting approval', value: fmtNum(queue.length), sub: overdueCount ? `${overdueCount} past ${APPROVAL_SLA_HOURS}h SLA` : 'All within SLA', tone: queue.length ? 'warn' : null, action: queue.length ? () => setSection('approvals') : null },
    { label: 'Active sellers', value: fmtNum(ov.sellers?.approved), sub: `${fmtNum(ov.sellers?.rejected)} rejected` },
    { label: 'Catalogue', value: fmtNum(ov.catalog?.products), sub: `${fmtCompact(ov.catalog?.units)} units · $${fmtCompact(ov.catalog?.inventoryValue)} listed value` },
    { label: 'Inquiries (30d)', value: fmtNum(ov.inquiries30d?.current), sub: `${fmtNum(ov.inquiries?.total)} all-time`, delta: inquiryDelta, spark: inquirySpark },
    { label: 'Seller response rate', value: fmtPct(ov.responseRate), sub: `${fmtPct(ov.acceptanceRate)} of responses accepted` },
  ];

  const inquiryBreakdown = ['pending', 'accepted', 'rejected'].map(s => ({ status: STATUS_META[s].label, count: ov.inquiries?.[s] || 0, color: `var(--mg-status-${s})` }));

  const activityText = (a) => {
    if (a.type === 'buyer_registered') return <><strong>@{a.actor}</strong> registered as a buyer</>;
    if (a.type === 'seller_registered') return <><strong>{a.actor}</strong> registered as a seller</>;
    return <><strong>@{a.actor || 'buyer'}</strong> sent an inquiry for <strong>{a.detail}</strong></>;
  };
  const activityIcon = { buyer_registered: '🚢', seller_registered: '🏭', inquiry: '✉️' };

  return (
    <div className="mg-shell">
      <Navbar />

      <div className="mg-layout">
        {/* ── Sidebar ── */}
        <aside className="mg-sidebar">
          <div className="mg-sidebar-title">Management Console</div>
          <nav>
            {nav.map(n => (
              <button key={n.id} className={`mg-nav ${section === n.id ? 'active' : ''}`} onClick={() => setSection(n.id)}>
                <span className="mg-nav-icon" aria-hidden="true">{n.icon}</span>
                <span>{n.label}</span>
                {n.badge > 0 && <span className="mg-nav-badge">{n.badge}</span>}
                {n.count !== undefined && <span className="mg-nav-count">{fmtNum(n.count)}</span>}
              </button>
            ))}
          </nav>
          <div className="mg-sidebar-foot">
            <div className="mg-online"><span className="mg-online-dot" />{fmtNum(ov.onlineUsers)} users online now</div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="mg-main">
          <header className="mg-header">
            <div>
              <div className="mg-eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <h1 className="mg-title">
                {section === 'overview' ? `${greeting()}, ${user?.username || 'Manager'}` : nav.find(n => n.id === section)?.label}
              </h1>
              <p className="mg-subtitle">
                {section === 'overview' && 'Marketplace health, growth and activity at a glance.'}
                {section === 'approvals' && 'Review every new buyer and seller before they can access the marketplace.'}
                {section === 'sellers' && 'All registered seller companies, their catalogue and inquiry activity.'}
                {section === 'buyers' && 'All registered buyers, their fleet and purchasing activity.'}
                {section === 'inquiries' && 'Every purchase inquiry flowing through the marketplace.'}
                {section === 'terms' && 'Legal record of every Terms & Conditions acceptance — account, document version, exact time, IP address and device.'}
              </p>
            </div>
            <div className="mg-header-actions">
              {lastUpdated && <span className="mg-updated">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button className="mg-btn mg-btn-ghost" onClick={() => fetchAll(true)} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </header>

          {/* ══ OVERVIEW ══ */}
          {section === 'overview' && (
            <>
              {queue.length > 0 && (
                <div className={`mg-alert ${overdueCount ? 'mg-alert-danger' : ''}`}>
                  <span className="mg-alert-icon" aria-hidden="true">{overdueCount ? '⚠️' : '🛡️'}</span>
                  <div>
                    <strong>{queue.length} account{queue.length > 1 ? 's' : ''} awaiting your approval</strong>
                    <span> — {pendingSellers.length} seller{pendingSellers.length !== 1 ? 's' : ''}, {pendingBuyers.length} buyer{pendingBuyers.length !== 1 ? 's' : ''}{overdueCount ? `. ${overdueCount} waiting longer than ${APPROVAL_SLA_HOURS} hours.` : '.'}</span>
                  </div>
                  <button className="mg-btn mg-btn-primary" onClick={() => setSection('approvals')}>Review queue</button>
                </div>
              )}

              <section className="mg-kpis">
                {kpis.map(k => (
                  <div key={k.label} className={`mg-card mg-kpi ${k.tone ? `mg-kpi-${k.tone}` : ''} ${k.action ? 'clickable' : ''}`} onClick={k.action || undefined}>
                    <div className="mg-kpi-label">{k.label}</div>
                    <div className="mg-kpi-value">{k.value}</div>
                    {k.delta && <div className={`mg-delta mg-delta-${k.delta.dir}`}>{k.delta.dir === 'up' ? '▲' : k.delta.dir === 'down' ? '▼' : '•'} {k.delta.text}</div>}
                    <div className="mg-kpi-sub">{k.sub}</div>
                    {k.spark && <div className="mg-kpi-spark"><Sparkline values={k.spark} /></div>}
                  </div>
                ))}
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>New registrations</h3><span className="mg-card-meta">Last 30 days</span></div>
                  <LineChart
                    data={ov.signupTrend || []}
                    series={[{ key: 'buyers', label: 'Buyers', color: SERIES[0] }, { key: 'sellers', label: 'Sellers', color: SERIES[1] }]}
                  />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Inquiry pipeline</h3><span className="mg-card-meta">All-time · {fmtNum(ov.inquiries?.total)}</span></div>
                  <RankBars items={inquiryBreakdown} labelKey="status" />
                  <div className="mg-stat-pair">
                    <div><span className="mg-stat-num">{fmtPct(ov.responseRate)}</span><span className="mg-stat-label">Responded</span></div>
                    <div><span className="mg-stat-num">{fmtPct(ov.acceptanceRate)}</span><span className="mg-stat-label">Accepted</span></div>
                  </div>
                </div>
              </section>

              <section className="mg-grid mg-grid-2-1">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Inquiry volume</h3><span className="mg-card-meta">Daily · last 30 days</span></div>
                  <BarChart data={ov.inquiryTrend || []} label="Inquiries" />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Approval queue</h3><button className="mg-link" onClick={() => setSection('approvals')}>View all →</button></div>
                  {queue.length === 0 ? (
                    <div className="mg-empty-sm">✓ All caught up — no pending accounts.</div>
                  ) : (
                    <ul className="mg-mini-list">
                      {queue.slice(0, 5).map(item => (
                        <li key={item.key}>
                          <span className="mg-avatar" aria-hidden="true">{item.kind === 'seller' ? '🏭' : '🚢'}</span>
                          <div className="mg-mini-main">
                            <div className="mg-strong">{item.name}</div>
                            <div className="mg-sub">{item.kind === 'seller' ? 'Seller' : 'Buyer'} · {timeAgo(item.created_at)}</div>
                          </div>
                          <div className="mg-mini-actions">
                            <button className="mg-icon-btn mg-icon-reject" title="Reject" disabled={busy.has(item.key)} onClick={() => reviewOne(item.kind, item.id, 'reject', `Reject ${item.name}?`)}>✕</button>
                            <button className="mg-icon-btn mg-icon-approve" title="Approve" disabled={busy.has(item.key)} onClick={() => reviewOne(item.kind, item.id, 'approve')}>✓</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="mg-grid mg-grid-3">
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Top sellers</h3><span className="mg-card-meta">By inquiries</span></div>
                  {(ov.topSellers || []).length === 0 ? <div className="mg-empty-sm">No approved sellers yet</div> : (
                    <table className="mg-table mg-table-compact">
                      <thead><tr><th>Company</th><th style={{ textAlign: 'right' }}>Products</th><th style={{ textAlign: 'right' }}>Inquiries</th></tr></thead>
                      <tbody>
                        {ov.topSellers.map(s => (
                          <tr key={s.id}>
                            <td><div className="mg-strong">{s.company_name}</div><div className="mg-sub">{s.country || '—'}</div></td>
                            <td style={{ textAlign: 'right' }}>{fmtNum(s.product_count)}</td>
                            <td style={{ textAlign: 'right' }}>{fmtNum(s.inquiry_count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Top markets</h3><span className="mg-card-meta">Accounts by country</span></div>
                  <RankBars items={ov.topCountries || []} labelKey="country" />
                </div>
                <div className="mg-card">
                  <div className="mg-card-head"><h3>Catalogue mix</h3><span className="mg-card-meta">Products by category</span></div>
                  <RankBars items={ov.topCategories || []} labelKey="category" />
                </div>
              </section>

              <section className="mg-card">
                <div className="mg-card-head"><h3>Recent activity</h3><span className="mg-card-meta">Latest events across the marketplace</span></div>
                {(ov.recentActivity || []).length === 0 ? <div className="mg-empty-sm">No activity yet</div> : (
                  <ul className="mg-feed">
                    {ov.recentActivity.map((a, i) => (
                      <li key={i}>
                        <span className="mg-avatar" aria-hidden="true">{activityIcon[a.type]}</span>
                        <div className="mg-feed-text">{activityText(a)}</div>
                        {a.status && <StatusPill status={a.status} />}
                        <span className="mg-feed-time">{timeAgo(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* ══ APPROVALS ══ */}
          {section === 'approvals' && (
            <div className="mg-card mg-table-card">
              <div className="mg-toolbar">
                <div className="mg-search">
                  <span aria-hidden="true">🔍</span>
                  <input value={queueQuery} onChange={(e) => setQueueQuery(e.target.value)} placeholder="Search name, email, country…" aria-label="Search approval queue" />
                </div>
                <div className="mg-chips">
                  {[['all', 'All', queue.length], ['seller', 'Sellers', pendingSellers.length], ['buyer', 'Buyers', pendingBuyers.length]].map(([id, label, count]) => (
                    <button key={id} className={`mg-chip ${queueFilter === id ? 'active' : ''}`} onClick={() => { setQueueFilter(id); setSelected(new Set()); }}>
                      {label}<span className="mg-chip-count">{count}</span>
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <div className="mg-bulk">
                    <span>{selected.size} selected</span>
                    <button className="mg-btn mg-btn-danger" onClick={() => reviewBulk('reject')}>Reject</button>
                    <button className="mg-btn mg-btn-success" onClick={() => reviewBulk('approve')}>Approve</button>
                  </div>
                )}
              </div>

              {visibleQueue.length === 0 ? (
                <div className="mg-empty-state">
                  <div className="mg-empty-icon">✓</div>
                  <h3>All caught up</h3>
                  <p>No pending registrations to review right now.</p>
                </div>
              ) : (
                <div className="mg-table-wrap">
                  <table className="mg-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" /></th>
                        <th>Applicant</th><th>Type</th><th>Contact</th><th>Country</th><th>Waiting</th><th style={{ textAlign: 'right' }}>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleQueue.map(item => {
                        const overdue = hoursSince(item.created_at) > APPROVAL_SLA_HOURS;
                        return (
                          <tr key={item.key} className={selected.has(item.key) ? 'selected' : ''}>
                            <td><input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSelect(item.key)} aria-label={`Select ${item.name}`} /></td>
                            <td>
                              <button className="mg-link mg-strong" onClick={() => setDrawer({ kind: item.kind, record: item.record })}>{item.name}</button>
                              <div className="mg-sub">@{item.username}{item.detail ? ` · ${item.detail}` : ''}</div>
                            </td>
                            <td><span className={`mg-type mg-type-${item.kind}`}>{item.kind === 'seller' ? '🏭 Seller' : '🚢 Buyer'}</span></td>
                            <td><div>{item.email}</div><div className="mg-sub">{item.phone}</div></td>
                            <td>{item.country || '—'}</td>
                            <td>
                              <div className={overdue ? 'mg-overdue' : ''}>{overdue ? '⚠ ' : ''}{timeAgo(item.created_at)}</div>
                              <div className="mg-sub">{fmtDateTime(item.created_at)}</div>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button className="mg-btn mg-btn-danger" disabled={busy.has(item.key)} onClick={() => reviewOne(item.kind, item.id, 'reject', `Reject ${item.name}? They will be notified by email.`)}>Reject</button>
                              <button className="mg-btn mg-btn-success" disabled={busy.has(item.key)} onClick={() => reviewOne(item.kind, item.id, 'approve')} style={{ marginLeft: 8 }}>
                                {busy.has(item.key) ? '…' : 'Approve'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ DIRECTORIES ══ */}
          {section === 'sellers' && (
            <DataTable
              rows={sellers}
              columns={sellerColumns}
              searchKeys={['company_name', 'username', 'contact_person', 'email', 'phone', 'country', 'city']}
              statusOptions={['approved', 'pending', 'rejected']}
              onRowClick={(r) => setDrawer({ kind: 'seller', record: r })}
              exportName="sellers"
              emptyText="No sellers match your filters."
            />
          )}

          {section === 'buyers' && (
            <DataTable
              rows={buyers}
              columns={buyerColumns}
              searchKeys={['username', 'email', 'phone', 'country']}
              statusOptions={['approved', 'pending', 'rejected']}
              onRowClick={(r) => setDrawer({ kind: 'buyer', record: r })}
              exportName="buyers"
              emptyText="No buyers match your filters."
            />
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

          {section === 'inquiries' && (
            <DataTable
              rows={inquiries}
              columns={inquiryColumns}
              searchKeys={['id', 'product_name', 'part_number', 'brand', 'buyer_username', 'seller_company', 'destination_location', 'vessel_name']}
              statusOptions={['pending', 'accepted', 'rejected']}
              exportName="inquiries"
              emptyText="No inquiries yet."
            />
          )}
        </main>
      </div>

      {/* ── Detail drawer ── */}
      {drawer && (
        <AccountDrawer
          kind={drawer.kind}
          record={drawer.record}
          busy={busy.has(`${drawer.kind}:${drawer.record.id}`)}
          onClose={() => setDrawer(null)}
          onDecision={(decision, confirmText) => reviewOne(drawer.kind, drawer.record.id, decision, confirmText)}
        />
      )}
    </div>
  );
}

function AccountDrawer({ kind, record: r, busy, onClose, onDecision }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = kind === 'seller' ? r.company_name : `@${r.username}`;
  const fields = kind === 'seller'
    ? [
        ['Username', `@${r.username}`], ['Contact person', r.contact_person], ['Email', r.email], ['Phone', r.phone],
        ['Company type', r.description], ['Address', r.address], ['City', r.city], ['Country', r.country],
        ['Payment mode', r.payment_mode], ['Products listed', r.product_count], ['Inquiries received', r.inquiry_count],
        ['Registered', fmtDateTime(r.created_at)], ['Last reviewed', fmtDateTime(r.reviewed_at)],
        ...termsFields(r),
      ]
    : [
        ['Username', `@${r.username}`], ['Email', r.email], ['Phone', r.phone], ['Country', r.country],
        ['Vessels', r.ship_count], ['Primary vessel', r.ship_name], ['Vessel type', r.ship_type], ['IMO number', r.imo_number],
        ['Inquiries sent', r.inquiry_count], ['Registered', fmtDateTime(r.created_at)], ['Last reviewed', fmtDateTime(r.reviewed_at)],
        ...termsFields(r),
      ];

  return (
    <div className="mg-drawer-backdrop" onClick={onClose}>
      <aside className="mg-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${name} details`}>
        <div className="mg-drawer-head">
          <div>
            <div className="mg-eyebrow">{kind === 'seller' ? 'Seller account' : 'Buyer account'}</div>
            <h2>{name}</h2>
            {r.status && <StatusPill status={r.status} />}
          </div>
          <button className="mg-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <dl className="mg-dl">
          {fields.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? '—' : value}</dd></div>
          ))}
        </dl>

        <div className="mg-drawer-actions">
          {r.status === 'pending' && (
            <>
              <button className="mg-btn mg-btn-danger" disabled={busy} onClick={() => onDecision('reject', `Reject ${name}? They will be notified by email.`)}>Reject</button>
              <button className="mg-btn mg-btn-success" disabled={busy} onClick={() => onDecision('approve')}>Approve account</button>
            </>
          )}
          {r.status === 'approved' && (
            <button className="mg-btn mg-btn-danger" disabled={busy} onClick={() => onDecision('reject', `Revoke access for ${name}? They will be signed out immediately and notified by email.`)}>Revoke access</button>
          )}
          {r.status === 'rejected' && (
            <button className="mg-btn mg-btn-success" disabled={busy} onClick={() => onDecision('approve', `Reinstate ${name}? They will be able to sign in again.`)}>Reinstate account</button>
          )}
        </div>
      </aside>
    </div>
  );
}
