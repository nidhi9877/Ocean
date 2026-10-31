import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const SOURCE_LABEL = { razorpay: 'Online recharge', admin: 'Admin adjustment', enquiry: 'Enquiry sent', refund: 'Refund' };

// Loads Razorpay Checkout once, on demand
let razorpayScript;
const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  razorpayScript ||= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => { razorpayScript = null; resolve(false); };
    document.body.appendChild(s);
  });
  return razorpayScript;
};

/**
 * Reseller wallet: header button with live balance + recharge / history modal.
 * Parent can call ref.open(reason) to show the modal (e.g. after a 402 on send),
 * ref.refresh() to reload, and read the current state via onChange.
 */
const ResellerWallet = forwardRef(function ResellerWallet({ token, user, onChange }, ref) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
      onChange?.(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, [token, onChange]);

  useEffect(() => { refresh(); }, [refresh]);

  useImperativeHandle(ref, () => ({
    open: (reason = '') => { setNotice(reason); setOpen(true); refresh(); },
    refresh,
  }), [refresh]);

  // Suggest the minimum amount whenever the modal opens
  useEffect(() => {
    if (open && data) setAmount(String(Math.ceil(data.minRecharge)));
  }, [open, data?.minRecharge]); // eslint-disable-line react-hooks/exhaustive-deps

  const recharge = async () => {
    const value = Number(amount);
    if (!(value >= data.minRecharge)) {
      toast.error(`Minimum recharge is ${inr(data.minRecharge)}.`);
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load the payment window. Check your connection and try again.');
      const { data: order } = await axios.post(`${API}/wallet/razorpay/order`, { amount: value }, auth);

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'MarineStockHub',
          description: 'Wallet recharge',
          prefill: { name: user?.username || '' },
          theme: { color: '#2563eb' },
          handler: async (response) => {
            try {
              const res = await axios.post(`${API}/wallet/razorpay/verify`, response, auth);
              toast.success(res.data.message, { duration: 5000 });
              setNotice('');
              await refresh();
            } catch (err) {
              toast.error(err.response?.data?.error || 'Payment could not be verified.', { duration: 8000 });
            }
            resolve();
          },
          modal: { ondismiss: resolve },
        });
        rzp.on('payment.failed', (resp) => {
          toast.error(resp.error?.description || 'Payment failed.');
        });
        rzp.open();
      });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not start the payment.');
    } finally {
      setPaying(false);
    }
  };

  const w = data?.wallet;
  const s = data?.settings;
  const lowBalance = w && s && w.balance < s.enquiry_price;
  const locked = w && !w.activated;

  return (
    <>
      <button
        type="button"
        onClick={() => { setNotice(''); setOpen(true); refresh(); }}
        className="btn btn-secondary"
        title="Your MarineStockHub wallet"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600,
          color: locked || lowBalance ? '#dc2626' : '#7c3aed',
          borderColor: locked || lowBalance ? 'rgba(220,38,38,0.4)' : 'rgba(124,58,237,0.4)',
        }}
      >
        <span>👛</span> Wallet: {w ? inr(w.balance) : '…'}
        {locked && <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>· Recharge to activate</span>}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !paying && setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Wallet"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', width: 640, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.08))' }}>
              <div>
                <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>👛 My Wallet</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  {s ? `${inr(s.enquiry_price)} is deducted each time you send an enquiry.` : 'Loading…'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} disabled={paying} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: 'var(--bg-body)' }}>
              {!data ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : (
                <>
                  {notice && (
                    <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#b91c1c', fontSize: '0.88rem', fontWeight: 600 }}>
                      ⚠️ {notice}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                    <div className="glass-card" style={{ padding: '1rem', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: '#7c3aed' }}>Balance</span>
                      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#7c3aed' }}>{inr(w.balance)}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {locked ? 'Not activated yet' : `≈ ${Math.floor(w.balance / s.enquiry_price)} enquiries left`}
                      </span>
                    </div>
                    <div className="glass-card" style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Price per enquiry</span>
                      <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{inr(s.enquiry_price)}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Per Send Enquiry click</span>
                    </div>
                  </div>

                  {locked && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                      Recharge at least <strong>{inr(s.min_initial_recharge)}</strong> to activate your wallet and start sending enquiries.
                    </p>
                  )}

                  {data.onlinePayment ? (
                    <div className="glass-card" style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                      <label htmlFor="wallet-amount" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                        Recharge amount (minimum {inr(data.minRecharge)})
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                          id="wallet-amount"
                          type="number"
                          min={Math.ceil(data.minRecharge)}
                          step="1"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="form-input"
                          style={{ flex: 1, minWidth: 140 }}
                        />
                        {[500, 1000, 2500, 5000].filter(v => v >= data.minRecharge).map(v => (
                          <button key={v} type="button" className="btn btn-secondary" onClick={() => setAmount(String(v))} style={{ padding: '0.45rem 0.8rem' }}>{inr(v)}</button>
                        ))}
                      </div>
                      <button type="button" className="btn btn-primary" onClick={recharge} disabled={paying}
                        style={{ marginTop: '0.75rem', width: '100%', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', fontWeight: 700 }}>
                        {paying ? 'Processing…' : `Pay ${inr(amount)} securely`}
                      </button>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', textAlign: 'center' }}>UPI · Cards · Netbanking via Razorpay</p>
                    </div>
                  ) : (
                    <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px dashed var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      💬 To recharge, contact MarineStockHub support with your username <strong>@{user?.username}</strong>. Your balance is updated as soon as payment is received.
                    </div>
                  )}

                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Recent transactions</h4>
                  {data.transactions.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No transactions yet.</div>
                  ) : (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', textAlign: 'left' }}>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Date</th>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Details</th>
                            <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.transactions.map(t => (
                            <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleString()}</td>
                              <td style={{ padding: '0.55rem 0.75rem' }}>
                                <div style={{ fontWeight: 600 }}>{SOURCE_LABEL[t.source] || t.source}</div>
                                {t.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.note}</div>}
                              </td>
                              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: t.type === 'credit' ? '#059669' : '#dc2626' }}>
                                {t.type === 'credit' ? '+' : '−'}{inr(t.amount)}
                              </td>
                              <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>{inr(t.balance_after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ResellerWallet;
