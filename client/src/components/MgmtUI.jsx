import { useState, useEffect, useMemo } from 'react';

// Shared building blocks for the management console and admin panel (styles in pages/ManagementDashboard.css)
export const PAGE_SIZE = 15;

// ─── Formatting helpers ──────────────────────────────────────────────────────────
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
export const fmtCompact = (n) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const fmtPct = (r) => r == null ? '—' : `${Math.round(r * 100)}%`;
export const hoursSince = (d) => (Date.now() - new Date(d).getTime()) / 36e5;
export const timeAgo = (d) => {
  const h = hoursSince(d);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const delta = (current, previous) => {
  if (!previous) return current ? { text: 'New', dir: 'up' } : { text: 'No change', dir: 'flat' };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs prev. 30d`, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
};

export const STATUS_META = {
  pending:  { icon: '⏳', label: 'Pending' },
  approved: { icon: '✓',  label: 'Approved' },
  rejected: { icon: '✕',  label: 'Rejected' },
  accepted: { icon: '✓',  label: 'Accepted' },
};

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || { icon: '•', label: status || 'Unknown' };
  return <span className={`mg-pill mg-pill-${status}`}><span aria-hidden="true">{meta.icon}</span>{meta.label}</span>;
}

export const toCsv = (rows, columns) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map(c => esc(c.label)).join(',');
  const body = rows.map(r => columns.map(c => esc(c.csv ? c.csv(r) : r[c.key])).join(',')).join('\n');
  return `${header}\n${body}`;
};

export const downloadCsv = (filename, csv) => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Generic directory table: search, status filter, sort, paginate, export ──────
export function DataTable({ rows, columns, searchKeys, statusOptions, statusKey = 'status', onRowClick, exportName, emptyText, defaultSort = 'created_at' }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ key: defaultSort, dir: 'desc' });
  const [page, setPage] = useState(1);

  const counts = useMemo(() => rows.reduce((acc, r) => ({ ...acc, [r[statusKey]]: (acc[r[statusKey]] || 0) + 1 }), {}), [rows, statusKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter(r =>
      (status === 'all' || r[statusKey] === status) &&
      (!q || searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q)))
    );
    const col = columns.find(c => c.key === sort.key);
    const val = (r) => col?.sortValue ? col.sortValue(r) : r[sort.key];
    out = [...out].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, query, status, sort, columns, searchKeys, statusKey]);

  useEffect(() => { setPage(1); }, [query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div className="mg-card mg-table-card">
      <div className="mg-toolbar">
        <div className="mg-search">
          <span aria-hidden="true">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" aria-label="Search" />
        </div>
        {statusOptions && (
          <div className="mg-chips" role="tablist">
            {['all', ...statusOptions].map(s => (
              <button key={s} className={`mg-chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
                {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
                <span className="mg-chip-count">{s === 'all' ? rows.length : counts[s] || 0}</span>
              </button>
            ))}
          </div>
        )}
        <button className="mg-btn mg-btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => downloadCsv(`${exportName}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered, columns))}>
          ⬇ Export CSV
        </button>
      </div>

      <div className="mg-table-wrap">
        <table className="mg-table">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} onClick={() => c.sortable !== false && toggleSort(c.key)} className={c.sortable !== false ? 'sortable' : ''} style={{ textAlign: c.align || 'left' }}>
                  {c.label}{sort.key === c.key && <span className="mg-sort">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length} className="mg-empty">{emptyText || 'No records match your filters.'}</td></tr>
            ) : visible.map((r, i) => (
              <tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'clickable' : ''}>
                {columns.map(c => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mg-pager">
        <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {fmtNum(filtered.length)}</span>
        <div>
          <button className="mg-btn mg-btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span className="mg-pager-page">Page {page} / {pages}</span>
          <button className="mg-btn mg-btn-ghost" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
        </div>
      </div>
    </div>
  );
}


// ─── Terms & Conditions acceptance evidence ─────────────────────────────────────
export function TermsCell({ at, version }) {
  if (!at) return <span className="mg-sub">Not recorded</span>;
  return (
    <div title={`Version ${version}`}>
      <span className="mg-pill mg-pill-approved"><span aria-hidden="true">✓</span>Accepted</span>
      <div className="mg-sub">{fmtDateTime(at)}</div>
    </div>
  );
}

export const termsFields = (r) => [
  ['T&C accepted', r.terms_accepted_at ? new Date(r.terms_accepted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'long' }) : 'Not recorded (registered before T&C tracking)'],
  ['T&C version', r.terms_version],
  ['Acceptance IP', r.terms_ip],
];

export const termsColumn = {
  key: 'terms_accepted_at',
  label: 'T&C',
  render: r => <TermsCell at={r.terms_accepted_at} version={r.terms_version} />,
  sortValue: r => r.terms_accepted_at ? new Date(r.terms_accepted_at).getTime() : 0,
  csv: r => r.terms_accepted_at ? `${new Date(r.terms_accepted_at).toISOString()} (v${r.terms_version}, IP ${r.terms_ip || 'n/a'})` : 'not recorded',
};

export const termsLogColumns = [
  { key: 'accepted_at', label: 'Accepted at', render: t => <div><div className="mg-strong">{fmtDateTime(t.accepted_at)}</div><div className="mg-sub mg-mono">{new Date(t.accepted_at).toISOString()}</div></div>, sortValue: t => new Date(t.accepted_at).getTime(), csv: t => new Date(t.accepted_at).toISOString() },
  { key: 'username', label: 'Account', render: t => <div><div className="mg-strong">@{t.username}</div><div className="mg-sub">{t.company_name || t.email}</div></div> },
  { key: 'role', label: 'Role', render: t => <span className="mg-type">{t.role}</span> },
  { key: 'email', label: 'Email' },
  { key: 'terms_version', label: 'Version', render: t => <span className="mg-mono">{t.terms_version}</span> },
  { key: 'ip_address', label: 'IP address', render: t => <span className="mg-mono">{t.ip_address || '—'}</span> },
  { key: 'user_agent', label: 'Device / browser', sortable: false, render: t => <span className="mg-sub" title={t.user_agent}>{(t.user_agent || '—').slice(0, 60)}{t.user_agent?.length > 60 ? '…' : ''}</span> },
  { key: 'content_hash', label: 'Document hash', sortable: false, render: t => <span className="mg-mono mg-sub" title={t.content_hash}>{t.content_hash?.slice(0, 12)}…</span> },
];
