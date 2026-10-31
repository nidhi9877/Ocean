import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTerms, termsOutline, TermsHeader, TermsBody } from '../components/Terms';

export default function TermsPage() {
  const { terms, error } = useTerms();
  const outline = useMemo(() => (terms ? termsOutline(terms.html) : []), [terms]);
  const [activePart, setActivePart] = useState(null);

  // Highlight the part currently in view
  useEffect(() => {
    if (!terms) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActivePart(visible.target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    document.querySelectorAll('.tc-body h1').forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [terms]);

  // Honour #anchor links once the document has rendered
  useEffect(() => {
    if (terms && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [terms]);

  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="tc-page">
      <nav className="tc-topbar">
        <Link to="/" className="tc-brand"><img src="/transparent_logo.png" alt="MarineStockHub" /></Link>
        <div className="tc-topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
          <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
        </div>
      </nav>

      {error && <div className="tc-error" style={{ margin: '6rem auto' }}>{error}</div>}
      {!terms && !error && <div className="tc-loading" style={{ minHeight: '60vh' }}><span className="spinner"></span></div>}

      {terms && (
        <div className="tc-layout">
          <aside className="tc-toc" aria-label="Contents">
            <div className="tc-toc-title">Contents</div>
            {outline.map(part => (
              <div key={part.id} className={`tc-toc-part ${activePart === part.id ? 'active' : ''}`}>
                <a href={`#${part.id}`} onClick={jump(part.id)} className="tc-toc-part-link">
                  <span className="tc-toc-letter">{part.letter}</span>{part.title.toLowerCase()}
                </a>
                {activePart === part.id && part.clauses.length > 0 && (
                  <ul>
                    {part.clauses.map(c => <li key={c.id}><a href={`#${c.id}`} onClick={jump(c.id)}>{c.title}</a></li>)}
                  </ul>
                )}
              </div>
            ))}
          </aside>

          <main className="tc-main">
            <TermsHeader terms={terms} />
            <div className="tc-summary">
              <strong>Applies to:</strong> all users of MarineStockHub. Part B applies additionally to Suppliers / Sellers, and Part C to Buyers.
              Acceptance is recorded electronically with the date, time and document version at registration.
            </div>
            <TermsBody html={terms.html} />
            <footer className="tc-footer">
              <div>Electronic acceptance by registered users is recorded against version <span className="tc-mono">{terms.version}</span>.</div>
              <div>Questions about these terms: <a href="mailto:growth@marinestockhub.com">growth@marinestockhub.com</a></div>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
