import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { fmtDateTime, timeAgo } from './MgmtUI';

const API = '/api';

// Management › Inactive Sellers: frozen accounts (reactivation requests first) and
// sellers currently inside their warning period.
export default function InactiveSellers({ authH, onCountChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/management/frozen-sellers`, authH);
      setData(res.data);
      onCountChange?.(res.data.sellers.filter(s => s.unfreeze_requested_at).length);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load inactive sellers.');
      setData({ sellers: [], rules: {} });
    }
  }, [authH, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const unfreeze = async (s) => {
    if (!window.confirm(`Reactivate ${s.company_name || s.username}? Their inventory becomes visible to buyers again.`)) return;
    setBusy(s.id);
    try {
      const res = await axios.put(`${API}/management/sellers/${s.id}/unfreeze`, {}, authH);
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reactivate.');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <div className="mg-loading" style={{ minHeight: 240 }}><div className="spinner"></div></div>;

  const frozen = data.sellers.filter(s => s.frozen_at);
  const warned = data.sellers.filter(s => !s.frozen_at && s.inactivity_warned_at);
  const graceMs = (data.rules.graceDays || 2) * 86400000;

  return (
    <>
      <section className="mg-card" style={{ marginBottom: '1rem' }}>
        <div className="mg-card-head">
          <h3>Frozen accounts · {frozen.length}</h3>
          <span className="mg-card-meta">Inventory hidden from buyers until reactivated</span>
        </div>
        {frozen.length === 0 ? <div className="mg-empty-sm">No frozen seller accounts.</div> : (
          <div className="mg-table-wrap">
            <table className="mg-table">
              <thead>
                <tr><th>Seller</th><th>Contact</th><th>Frozen</th><th>Last activity</th><th style={{ textAlign: 'right' }}>Listings</th><th>Reactivation request</th><th></th></tr>
              </thead>
              <tbody>
                {frozen.map(s => (
                  <tr key={s.id}>
                    <td><div className="mg-strong">{s.company_name}</div><div className="mg-sub">@{s.username}</div></td>
                    <td><div>{s.email}</div><div className="mg-sub">{s.phone}</div></td>
                    <td>{fmtDateTime(s.frozen_at)}</td>
                    <td>{s.last_activity ? timeAgo(s.last_activity) : 'Never'}</td>
                    <td style={{ textAlign: 'right' }}>{s.product_count}</td>
                    <td>
                      {s.unfreeze_requested_at ? (
                        <>
                          <span className="mg-pill mg-pill-pending">Requested {timeAgo(s.unfreeze_requested_at)}</span>
                          {s.unfreeze_note && <div className="mg-sub" style={{ marginTop: 4, maxWidth: 260 }}>“{s.unfreeze_note}”</div>}
                        </>
                      ) : <span className="mg-sub">No request yet</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="mg-btn mg-btn-success" disabled={busy === s.id} onClick={() => unfreeze(s)}>
                        {busy === s.id ? 'Reactivating…' : 'Approve & Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mg-card">
        <div className="mg-card-head">
          <h3>Warned — freeze pending · {warned.length}</h3>
          <span className="mg-card-meta">Inactive {data.rules.inactivityDays || 7}+ days; frozen {data.rules.graceDays || 2} days after the warning unless they sign in</span>
        </div>
        {warned.length === 0 ? <div className="mg-empty-sm">No sellers in the warning period.</div> : (
          <div className="mg-table-wrap">
            <table className="mg-table">
              <thead><tr><th>Seller</th><th>Contact</th><th>Warned</th><th>Freezes on</th><th>Last activity</th></tr></thead>
              <tbody>
                {warned.map(s => (
                  <tr key={s.id}>
                    <td><div className="mg-strong">{s.company_name}</div><div className="mg-sub">@{s.username}</div></td>
                    <td><div>{s.email}</div><div className="mg-sub">{s.phone}</div></td>
                    <td>{fmtDateTime(s.inactivity_warned_at)}</td>
                    <td className="mg-strong">{fmtDateTime(new Date(new Date(s.inactivity_warned_at).getTime() + graceMs))}</td>
                    <td>{s.last_activity ? timeAgo(s.last_activity) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
