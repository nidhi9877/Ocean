import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { DataTable, StatusPill, fmtDate, fmtDateTime, timeAgo } from './MgmtUI';

const API = '/api';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const SOURCE_LABEL = { razorpay: 'Online recharge (Razorpay)', admin: 'Admin adjustment', enquiry: 'Enquiry sent', refund: 'Refund' };

// Admin › Resellers: wallet pricing, every reseller's balance, manual top-ups / corrections
export default function AdminResellers({ authH }) {
  const [rows, setRows] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/resellers`, authH);
      setRows(res.data.resellers);
      setSettings(res.data.settings);
      setForm(res.data.settings);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load resellers.');
      setRows([]);
    }
  }, [authH]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API}/admin/wallet-settings`, form, authH);
      setSettings(res.data.settings);
      toast.success('Wallet settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'username', label: 'Reseller', render: r => <div><div className="mg-strong">@{r.username}</div><div className="mg-sub">{r.email || ''}</div></div> },
    { key: 'phone', label: 'Phone', render: r => r.phone || '—', sortable: false },
    { key: 'country', label: 'Country', render: r => r.country || '—' },
    { key: 'balance', label: 'Balance', align: 'right', render: r => <span className="mg-strong" style={{ color: r.activated_at ? undefined : 'var(--mg-status-rejected)' }}>{inr(r.balance)}</span>, csv: r => r.balance },
    { key: 'activated_at', label: 'Wallet', render: r => r.activated_at ? <span className="mg-pill mg-pill-approved">Active</span> : <span className="mg-pill mg-pill-pending">Awaiting ₹{settings?.min_initial_recharge}</span>, sortValue: r => r.activated_at ? 1 : 0, csv: r => r.activated_at ? 'active' : 'not activated' },
    { key: 'total_recharged', label: 'Recharged', align: 'right', render: r => inr(r.total_recharged), csv: r => r.total_recharged },
    { key: 'enquiries_paid', label: 'Enquiries', align: 'right', render: r => r.enquiries_paid },
    { key: 'total_spent', label: 'Spent', align: 'right', render: r => inr(r.total_spent), csv: r => r.total_spent },
    { key: 'status', label: 'Access', render: r => <StatusPill status={r.status || 'approved'} /> },
    { key: 'last_seen', label: 'Last seen', render: r => r.last_seen ? timeAgo(r.last_seen) : 'Never', sortValue: r => r.last_seen ? new Date(r.last_seen).getTime() : 0, csv: r => fmtDateTime(r.last_seen) },
    { key: 'created_at', label: 'Joined', render: r => fmtDate(r.created_at), sortValue: r => new Date(r.created_at).getTime(), csv: r => fmtDate(r.created_at) },
  ];

  if (!rows) return <div className="mg-loading" style={{ minHeight: 240 }}><div className="spinner"></div></div>;

  const field = (key, label, hint) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 180px' }}>
      <span className="mg-sub" style={{ fontWeight: 600 }}>{label}</span>
      <input type="number" min="0" step="1" className="form-input" value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
      <span className="mg-sub">{hint}</span>
    </label>
  );

  return (
    <>
      <section className="mg-card" style={{ marginBottom: '1rem' }}>
        <div className="mg-card-head"><h3>Wallet pricing</h3><span className="mg-card-meta">Applies to all resellers</span></div>
        <form onSubmit={saveSettings} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', padding: '0 1.25rem 1.25rem' }}>
          {field('enquiry_price', 'Price per enquiry (₹)', 'Deducted on every Send Enquiry click')}
          {field('min_initial_recharge', 'Minimum first recharge (₹)', 'Enquiries are locked until the balance first reaches this')}
          {field('min_topup', 'Minimum later top-up (₹)', 'Minimum for online top-ups after activation')}
          <button type="submit" className="mg-btn mg-btn-success" disabled={saving}>{saving ? 'Saving…' : 'Save pricing'}</button>
        </form>
      </section>

      <DataTable
        rows={rows.map(r => ({ ...r, id: r.user_id }))}
        columns={columns}
        searchKeys={['username', 'email', 'phone', 'country']}
        statusOptions={['approved', 'rejected']}
        onRowClick={(r) => setOpenId(r.user_id)}
        exportName="resellers"
        emptyText="No resellers yet. They register from the login page → Reseller."
      />

      {openId && <WalletDrawer userId={openId} authH={authH} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  );
}

function WalletDrawer({ userId, authH, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [type, setType] = useState('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/resellers/${userId}/wallet`, authH);
      setData(res.data);
    } catch {
      toast.error('Failed to load wallet.');
      onClose();
    }
  }, [userId, authH, onClose]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return toast.error('Enter an amount.');
    if (!note.trim()) return toast.error('Add a note, e.g. the bank transfer / UPI reference.');
    if (!window.confirm(`${type === 'credit' ? 'Add' : 'Deduct'} ${inr(value)} ${type === 'credit' ? 'to' : 'from'} @${data.user.username}'s wallet?`)) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/admin/resellers/${userId}/wallet`, { type, amount: value, note }, authH);
      toast.success(res.data.message);
      setAmount(''); setNote('');
      await load();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update wallet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mg-drawer-backdrop" onClick={onClose}>
      <aside className="mg-drawer" style={{ width: 'min(640px, 100%)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Reseller wallet">
        <div className="mg-drawer-head">
          <div>
            <div className="mg-eyebrow">Reseller wallet</div>
            <h2>{data ? `@${data.user.username}` : '…'}</h2>
            {data && <div className="mg-strong" style={{ fontSize: '1.5rem' }}>{inr(data.wallet.balance)} {!data.wallet.activated && <span className="mg-pill mg-pill-pending" style={{ fontSize: '0.75rem', verticalAlign: 'middle' }}>Not activated</span>}</div>}
          </div>
          <button className="mg-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!data ? <div className="mg-loading" style={{ minHeight: 200 }}><div className="spinner"></div></div> : (
          <div style={{ flex: 1, padding: '0 1.5rem 1.5rem' }}>
            <h3 className="mg-drawer-section">Manual top-up / correction</h3>
            <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="form-select" value={type} onChange={e => setType(e.target.value)} style={{ width: 150 }}>
                  <option value="credit">Add money</option>
                  <option value="debit">Deduct money</option>
                </select>
                <input type="number" min="1" step="1" className="form-input" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1 }} />
              </div>
              <input className="form-input" placeholder="Note — e.g. UPI ref 4321… / bank transfer 12 Nov" value={note} onChange={e => setNote(e.target.value)} maxLength={300} />
              <button type="submit" className={`mg-btn ${type === 'credit' ? 'mg-btn-success' : 'mg-btn-danger'}`} disabled={busy}>
                {busy ? 'Saving…' : type === 'credit' ? 'Add to wallet' : 'Deduct from wallet'}
              </button>
            </form>

            <h3 className="mg-drawer-section">Transactions · {data.transactions.length}</h3>
            {data.transactions.length === 0 ? <div className="mg-empty-sm">No transactions yet.</div> : (
              <table className="mg-table mg-table-compact">
                <thead><tr><th>Date</th><th>Details</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
                <tbody>
                  {data.transactions.map(t => (
                    <tr key={t.id}>
                      <td>{fmtDateTime(t.created_at)}</td>
                      <td><div className="mg-strong">{SOURCE_LABEL[t.source] || t.source}</div>{t.note && <div className="mg-sub">{t.note}</div>}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'credit' ? 'var(--mg-status-approved, #059669)' : 'var(--mg-status-rejected)' }}>{t.type === 'credit' ? '+' : '−'}{inr(t.amount)}</td>
                      <td style={{ textAlign: 'right' }}>{inr(t.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
