import { useState, useEffect, useRef } from 'react';

const RESEND_SECONDS = 60;

// Step 2 of registration: the applicant enters the 6-digit code emailed to them.
// `onVerify(code)` should submit the registration and throw an Error with a message on failure.
export default function EmailOtpModal({ email, onVerify, onResend, onClose }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputs = useRef([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  const submit = async (value = code) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await onVerify(value);
    } catch (err) {
      setError(err.message);
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const setDigit = (i, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      // Pasted or autofilled the full code
      const next = clean.slice(0, 6).split('');
      const filled = [...next, ...Array(6 - next.length).fill('')];
      setDigits(filled);
      inputs.current[Math.min(next.length, 5)]?.focus();
      if (next.length === 6) submit(next.join(''));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    if (clean && next.every(Boolean)) submit(next.join(''));
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'Enter') submit();
  };

  const resend = async () => {
    setError('');
    try {
      await onResend();
      setCooldown(RESEND_SECONDS);
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass-card" role="dialog" aria-label="Verify your email" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>📧</div>
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.4rem', color: 'var(--text-primary)' }}>Verify your email</h2>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
          We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{email}</strong>. Enter it below to complete your registration.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? 6 : 1}
              aria-label={`Digit ${i + 1}`}
              disabled={verifying}
              className="form-input"
              style={{ width: '46px', height: '54px', padding: 0, textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
            />
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', fontSize: '0.86rem' }}>
            {error}
          </div>
        )}

        <button type="button" className="btn btn-primary btn-block btn-lg" disabled={code.length !== 6 || verifying} onClick={() => submit()}>
          {verifying ? <span className="spinner"></span> : 'Verify & Register'}
        </button>

        <div style={{ marginTop: '1.1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Didn't get it? Check spam, or{' '}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: cooldown > 0 ? 'var(--text-muted)' : 'var(--accent-primary)', cursor: cooldown > 0 ? 'default' : 'pointer' }}
          >
            {cooldown > 0 ? `resend in ${cooldown}s` : 'resend code'}
          </button>
        </div>
        <button type="button" onClick={onClose} style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
          ← Change email or details
        </button>
      </div>
    </div>
  );
}
