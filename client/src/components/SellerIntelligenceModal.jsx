import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const API = '/api';
const fmt = (n) => Number(n || 0).toLocaleString();

const TABS = {
  spares: {
    label: '🔧 Spares Demand Status',
    gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    ownLabel: 'Your Spares (Qty)',
    nameLabel: 'Name of Spares',
    marketLabel: 'Total Spares in MarineStockHub Marketplace',
    empty: 'You have no spare parts listed yet.',
  },
  sets: {
    label: '📦 Complete Set Demand Status',
    gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
    ownLabel: 'Your Complete Sets (Qty)',
    nameLabel: 'Name of Complete Set (Manufacturer + Model)',
    marketLabel: 'Total Complete Sets in MarineStockHub Marketplace',
    empty: 'You have no complete sets listed yet.',
  },
};

const th = { padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const td = { padding: '0.6rem 0.75rem', verticalAlign: 'top' };

function StatCard({ title, value, sub, color = 'var(--text-primary)', border = 'var(--border-color)' }) {
  return (
    <div className="glass-card" style={{ padding: '1rem', background: 'var(--bg-surface)', border: `1px solid ${border}`, borderRadius: 'var(--radius-md)' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color, letterSpacing: '0.5px' }}>{title}</span>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, marginTop: '0.25rem' }}>{fmt(value)}</div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub}</span>
    </div>
  );
}

export default function SellerIntelligenceModal({ token, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('spares');

  useEffect(() => {
    axios.get(`${API}/provider/intelligence`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setData(res.data))
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load Seller Intelligence.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const downloadExcel = () => {
    const sheet = (rows, t) => XLSX.utils.json_to_sheet(rows.length ? rows.map((r, i) => ({
      '#': i + 1,
      'Equipment': r.equipment || '—',
      'Manufacturer': r.manufacturer || '—',
      'Model No.': r.model || '—',
      'Number of Live Ships': r.live_ships,
      [TABS[t].ownLabel]: r.own_units,
      [TABS[t].nameLabel]: r.names.join(', ') || '—',
      [TABS[t].marketLabel]: r.market_units,
      'Sellers in Market': r.market_sellers,
    })) : [{ '#': '', Equipment: TABS[t].empty }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(data.spares, 'spares'), 'Spares Demand Status');
    XLSX.utils.book_append_sheet(wb, sheet(data.sets, 'sets'), 'Complete Set Demand Status');
    XLSX.writeFile(wb, `Seller_Intelligence_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const s = data?.summary;
  const rows = data ? data[tab] : [];
  const cfg = TABS[tab];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Seller Intelligence"
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', width: 1080, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn 0.25s', border: '1px solid var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(124,58,237,0.08))' }}>
          <div>
            <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '1.3rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <span>🧠</span> Seller Intelligence
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Where your stock stands in the market — installed base on live ships vs. supply across MarineStockHub
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', background: 'var(--bg-body)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Analyzing market demand...</h4>
              <p style={{ fontSize: '0.85rem' }}>Matching your stock against vessels on the platform and other sellers' inventory...</p>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>Failed to load Seller Intelligence.</div>
          ) : (
            <>
              {/* Top-line stock numbers (units) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <StatCard title="Total Complete Stock" value={s.total_units} sub="Spares + complete sets (new + refurbished)" color="var(--accent-primary)" border="rgba(37,99,235,0.3)" />
                <StatCard title="New Spares" value={s.new_spares} sub="Units in stock" color="#059669" border="rgba(5,150,105,0.3)" />
                <StatCard title="Refurbished Spares" value={s.refurbished_spares} sub="Units in stock" color="#d97706" border="rgba(217,119,6,0.3)" />
                <StatCard title="New Complete Sets" value={s.new_sets} sub="Units in stock" color="#7c3aed" border="rgba(124,58,237,0.3)" />
                <StatCard title="Refurbished Complete Sets" value={s.refurbished_sets} sub="Units in stock" color="#db2777" border="rgba(219,39,119,0.3)" />
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📋</span> Market Demand Status
                </h4>
                <div role="tablist" style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
                  {Object.entries(TABS).map(([key, t]) => {
                    const active = tab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTab(key)}
                        style={{ padding: '0.45rem 1rem', borderRadius: 'var(--radius-full)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', transition: 'all 0.15s', border: 'none', background: active ? t.gradient : 'transparent', color: active ? 'white' : 'var(--text-secondary)' }}
                      >
                        <span>{t.label}</span>
                        <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'rgba(37,99,235,0.1)', color: active ? 'white' : 'var(--accent-primary)', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                          {data[key].length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                  <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{cfg.empty}</p>
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 2 }}>
                        <th style={{ ...th, width: 40 }}>#</th>
                        <th style={th}>Equipment</th>
                        <th style={th}>Manufacturer</th>
                        <th style={th}>Model No.</th>
                        <th style={{ ...th, textAlign: 'center' }} title="Vessels on the platform with the same manufacturer and model installed">Number of Live Ships</th>
                        <th style={{ ...th, textAlign: 'center' }}>{cfg.ownLabel}</th>
                        <th style={th}>{cfg.nameLabel}</th>
                        <th style={{ ...th, textAlign: 'center', whiteSpace: 'normal', minWidth: 150 }}>{cfg.marketLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={`${r.manufacturer}|${r.model}|${r.equipment}|${i}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ ...td, color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary)' }}>{r.equipment || '—'}</td>
                          <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.manufacturer || '—'}</td>
                          <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.model || '—'}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: r.live_ships > 0 ? '#059669' : 'var(--text-muted)' }}>
                            {fmt(r.live_ships)} {r.live_ships === 1 ? 'ship' : 'ships'}
                          </td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(r.own_units)}</td>
                          <td style={{ ...td, color: 'var(--text-secondary)' }}>
                            {r.names.length ? (
                              <span title={r.names.join(', ')}>
                                {r.names.slice(0, 4).join(', ')}{r.names.length > 4 && ` + ${r.names.length - 4} more`}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{fmt(r.market_units)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {r.other_sellers === 0 ? 'Only you' : `You + ${r.other_sellers} other seller${r.other_sellers === 1 ? '' : 's'}`}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>💡</span> Live ships = vessels on the platform with the same manufacturer and model number installed.
          </span>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Close</button>
            <button type="button" className="btn btn-primary" onClick={downloadExcel} disabled={!data}
              style={{ padding: '0.55rem 1.4rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
              <span>📥</span> Download (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
