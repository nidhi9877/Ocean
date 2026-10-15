import { useState, useEffect } from 'react';

const FALLBACK_ITEMS = [
  {
    id: 'fb-1',
    type: 'fact',
    category: 'OCEAN FACT',
    title: 'The oceans generate over 50% of the oxygen we breathe, largely produced by marine phytoplankton.',
    icon: '🌊',
    source: 'National Ocean Service'
  },
  {
    id: 'fb-2',
    type: 'fact',
    category: 'GLOBAL FLEET',
    title: 'Over 90% of international trade is transported across oceans by a global fleet of 55,000+ merchant vessels.',
    icon: '🚢',
    source: 'International Maritime Organization'
  },
  {
    id: 'fb-3',
    type: 'fact',
    category: 'DEEP ABYSS',
    title: 'The Challenger Deep in Mariana Trench reaches ~10,994m (36,070 ft)—deeper than Mount Everest is tall.',
    icon: '⚓',
    source: 'Ocean Exploration'
  },
  {
    id: 'fb-4',
    type: 'fact',
    category: 'EFFICIENCY',
    title: 'Commercial container ships emit fewer greenhouse gases per ton-km than air, rail, or highway freight.',
    icon: '🌱',
    source: 'World Shipping Council'
  },
  {
    id: 'fb-5',
    type: 'fact',
    category: 'CHOKEPOINTS',
    title: 'The Strait of Malacca carries over 85,000 ships per year, connecting the Indian and Pacific Oceans.',
    icon: '🧭',
    source: 'Global Maritime Logistics'
  },
  {
    id: 'fb-6',
    type: 'fact',
    category: 'PROPULSION',
    title: 'Modern low-speed 2-stroke marine engines exceed 50% thermal efficiency, highest among thermal engines.',
    icon: '⚙️',
    source: 'Marine Propulsion Review'
  },
  {
    id: 'fb-7',
    type: 'fact',
    category: 'DIGITAL LIFELINE',
    title: 'Over 95% of international internet traffic travels across the seabed via submarine fiber optic cables.',
    icon: '🌐',
    source: 'Submarine Telecoms'
  },
  {
    id: 'fb-8',
    type: 'fact',
    category: 'MEGA VESSELS',
    title: 'The largest ultra-large container vessels exceed 400m in length and carry up to 24,000 TEU containers.',
    icon: '📦',
    source: 'Maritime Fleet Review'
  }
];

export default function MarineNewsTicker() {
  const [items, setItems] = useState(FALLBACK_ITEMS);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchNews = async (force = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/news${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.items && data.items.length > 0) {
          setItems(data.items);
          setLastRefreshed(new Date());
        }
      }
    } catch (err) {
      console.warn('Could not fetch latest marine news, using fallback facts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      fetchNews();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate items to ensure smooth infinite loop
  const displayItems = [...items, ...items];

  return (
    <div className="marine-ticker-banner" role="region" aria-label="Marine and Ocean News Ticker">
      {/* Static Left Brand / Live Badge */}
      <div className="marine-ticker-badge">
        <span className="ticker-pulse-dot" />
        <span className="ticker-badge-text">OCEAN RADAR</span>
      </div>

      {/* Scrolling Track Area */}
      <div 
        className={`marine-ticker-track-wrapper ${isPaused ? 'is-paused' : ''}`}
        title="Hover to pause or click article to read"
      >
        <div className={`marine-ticker-track ${isPaused ? 'paused' : ''}`}>
          {displayItems.map((item, index) => {
            const isNews = item.type === 'news';
            return (
              <div 
                key={`${item.id}-${index}`} 
                className={`ticker-item ${isNews ? 'ticker-item-news' : 'ticker-item-fact'}`}
              >
                <span className="ticker-icon">{item.icon || (isNews ? '📰' : '🌊')}</span>
                <span className="ticker-category-tag">{item.category || (isNews ? 'MARITIME DISPATCH' : 'OCEAN FACT')}</span>
                
                {isNews && item.url ? (
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="ticker-text ticker-link"
                    title={`Read on ${item.source || 'source'} (opens in new tab)`}
                  >
                    {item.title}
                    <span className="ticker-external-icon">↗</span>
                  </a>
                ) : (
                  <span className="ticker-text">{item.title}</span>
                )}

                {item.source && (
                  <span className="ticker-source-tag">via {item.source}</span>
                )}

                <span className="ticker-separator">✦</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Controls */}
      <div className="marine-ticker-controls">
        <button
          type="button"
          className="ticker-control-btn"
          onClick={() => setIsPaused(!isPaused)}
          title={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
          aria-label={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
        <button
          type="button"
          className={`ticker-control-btn ${loading ? 'spinning' : ''}`}
          onClick={() => fetchNews(true)}
          title="Refresh marine news"
          aria-label="Refresh marine news"
          disabled={loading}
        >
          🔄
        </button>
      </div>
    </div>
  );
}
