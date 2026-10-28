import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import '../pages/Terms.css';

// ─── Data ────────────────────────────────────────────────────────────────────────
// The terms are served by the API with a content-derived version, which is sent back
// on registration so the server can record exactly which wording was accepted.
let cache = null;

export function useTerms() {
  const [terms, setTerms] = useState(cache);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cache) return;
    axios.get('/api/legal/terms')
      .then(res => { cache = res.data; setTerms(res.data); })
      .catch(() => setError('Unable to load the Terms & Conditions. Please refresh the page.'));
  }, []);

  return { terms, error };
}

export const fmtLegalDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

// Parts (h1) and clauses (h2) for the table of contents
export function termsOutline(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts = [];
  doc.querySelectorAll('h1, h2').forEach(h => {
    if (h.tagName === 'H1') parts.push({ id: h.id, title: h.textContent.replace(/^PART\s+([A-Z])\s+—\s+/, ''), letter: h.textContent.match(/^PART\s+([A-Z])/)?.[1], clauses: [] });
    else if (parts.length) parts[parts.length - 1].clauses.push({ id: h.id, title: h.textContent });
  });
  return parts;
}

// ─── Document body ───────────────────────────────────────────────────────────────
export function TermsBody({ html }) {
  // Content is generated server-side from the company's own Word document (legal/build-terms.mjs)
  return <article className="tc-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TermsHeader({ terms, compact = false }) {
  return (
    <header className={`tc-header ${compact ? 'tc-header-compact' : ''}`}>
      <div className="tc-eyebrow">Legal · MarineStockHub</div>
      <h1 className="tc-title">{terms.title}</h1>
      <dl className="tc-meta">
        <div><dt>Operator</dt><dd>{terms.operator}</dd></div>
        <div><dt>Effective</dt><dd>{fmtLegalDate(terms.effectiveDate)}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{terms.jurisdiction}</dd></div>
        <div><dt>Version</dt><dd className="tc-mono">{terms.version}</dd></div>
      </dl>
    </header>
  );
}

// ─── Reading modal used during registration ──────────────────────────────────────
// "I Agree" unlocks once the reader has scrolled to the end of the document.
export function TermsModal({ onAccept, onClose }) {
  const { terms, error } = useTerms();
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const scroller = useRef(null);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max <= 0 ? 1 : el.scrollTop / max;
    setProgress(p);
    if (p > 0.985) setReachedEnd(true);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => { if (terms) onScroll(); }, [terms, onScroll]);

  return (
    <div className="tc-modal-backdrop" onClick={onClose}>
      <div className="tc-modal" role="dialog" aria-modal="true" aria-label="Terms and Conditions" onClick={(e) => e.stopPropagation()}>
        <div className="tc-modal-top">
          <div>
            <div className="tc-eyebrow">Please read carefully</div>
            <div className="tc-modal-title">Terms &amp; Conditions</div>
          </div>
          <a className="tc-modal-link" href="/terms" target="_blank" rel="noopener noreferrer">Open full page ↗</a>
          <button className="tc-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tc-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>

        <div className="tc-modal-scroll" ref={scroller} onScroll={onScroll}>
          {error && <div className="tc-error">{error}</div>}
          {!terms && !error && <div className="tc-loading"><span className="spinner"></span></div>}
          {terms && (
            <>
              <TermsHeader terms={terms} compact />
              <TermsBody html={terms.html} />
              <div className="tc-end">End of document</div>
            </>
          )}
        </div>

        <div className="tc-modal-foot">
          <span className="tc-foot-note">
            {reachedEnd ? '✓ You have reached the end of the document.' : 'Scroll to the end of the document to continue.'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Decline</button>
          <button type="button" className="btn btn-primary" disabled={!terms || !reachedEnd} onClick={() => onAccept(terms.version)}>
            I Have Read &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checkbox block for the registration forms ───────────────────────────────────
// `value` is the accepted terms version (or null). Ticking the box always goes through
// the reading modal, so every acceptance follows an actual view of the document.
export function TermsAcceptance({ value, onChange, role }) {
  const [open, setOpen] = useState(false);
  const accepted = Boolean(value);

  return (
    <div className={`tc-accept ${accepted ? 'is-accepted' : ''}`}>
      <label className="tc-accept-row">
        <input
          type="checkbox"
          checked={accepted}
          onChange={() => (accepted ? onChange(null) : setOpen(true))}
        />
        <span>
          I have read and agree to the{' '}
          <button type="button" className="tc-inline-link" onClick={() => setOpen(true)}>Terms &amp; Conditions</button>
          {role === 'seller' ? ', including the Supplier / Vendor Agreement (Part B)' : role === 'buyer' ? ', including the Buyer Terms (Part C)' : ''}
          {' '}of MarineStockHub, operated by Khalasi Marine OPC Private Limited.
        </span>
      </label>
      {accepted && <div className="tc-accept-note">Your acceptance will be recorded with the date, time and version ({value}) when you complete registration.</div>}
      {open && (
        <TermsModal
          onClose={() => setOpen(false)}
          onAccept={(version) => { onChange(version); setOpen(false); }}
        />
      )}
    </div>
  );
}
