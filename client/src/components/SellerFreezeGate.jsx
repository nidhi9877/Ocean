import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

const API = '/api';
const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Wraps every seller page. If the seller's account was frozen for inactivity, the page is
 * replaced by a notice and a reactivation request form — nothing else is accessible
 * (the API also refuses seller requests while frozen).
 */
export default function SellerFreezeGate({ children }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/seller/freeze-status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => alive && setStatus(res.data))
      .catch(() => {}) // no seller profile yet (registration) — let the page handle it
      .finally(() => alive && setChecked(true));
    return () => { alive = false; };
  }, [token]);

  if (!checked) {
    return <div className="page-container"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  }
  if (!status?.frozen) return children;

  const requested = !!status.unfreezeRequestedAt;

  const sendRequest = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await axios.post(`${API}/seller/unfreeze-request`, { note }, { headers: { Authorization: `Bearer ${token}` } });
      setStatus(res.data.status);
      toast.success(res.data.message, { duration: 6000 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send the request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="glass-card" style={{ maxWidth: 560, width: '100%', padding: '2.25rem 2rem', textAlign: 'center', borderTop: '4px solid var(--danger)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--danger)' }}>Account frozen</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.6rem', margin: '0.5rem 0 1rem', color: 'var(--text-primary)' }}>
            Your seller account is frozen due to inactivity
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 0.75rem' }}>
            Your account was frozen on <strong>{fmt(status.frozenAt)}</strong> because it was not used for an extended period.
            Your inventory is currently <strong>hidden from all buyers</strong>, and the seller dashboard is unavailable.
          </p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
            To unfreeze your account, send a reactivation request to MarineStockHub. Management will review it and notify you by email.
          </p>

          {requested ? (
            <div style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Reactivation requested on <strong>{fmt(status.unfreezeRequestedAt)}</strong>. It is awaiting management approval.
            </div>
          ) : (
            <form onSubmit={sendRequest} style={{ display: 'grid', gap: '0.75rem', textAlign: 'left' }}>
              <label htmlFor="unfreeze-note" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Message to MarineStockHub (optional)
              </label>
              <textarea
                id="unfreeze-note"
                className="form-input"
                rows={3}
                maxLength={500}
                placeholder="e.g. We were away for dry-dock season and will update our stock today."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={sending} style={{ justifySelf: 'center', minWidth: 240 }}>
                {sending ? 'Sending…' : 'Request Account Reactivation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
