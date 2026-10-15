import { Router } from 'express';

const router = Router();

// In-memory cache for news to respect rate limits
let cachedItems = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const MARINE_FACTS = [
  {
    id: 'fact-1',
    type: 'fact',
    category: 'OCEAN FACT',
    title: 'The oceans generate over 50% of the oxygen we breathe, largely produced by marine phytoplankton.',
    icon: '🌊',
    source: 'National Ocean Service'
  },
  {
    id: 'fact-2',
    type: 'fact',
    category: 'GLOBAL TRADE',
    title: 'Over 90% of all international trade is transported across oceans by a global fleet of 55,000+ merchant vessels.',
    icon: '🚢',
    source: 'International Maritime Organization (IMO)'
  },
  {
    id: 'fact-3',
    type: 'fact',
    category: 'DEEP ABYSS',
    title: 'The Challenger Deep in the Mariana Trench reaches ~10,994 meters (36,070 ft)—deeper than Mount Everest is tall.',
    icon: '⚓',
    source: 'Ocean Exploration'
  },
  {
    id: 'fact-4',
    type: 'fact',
    category: 'EFFICIENCY',
    title: 'Modern commercial container ships emit fewer greenhouse gases per ton-kilometer than air, rail, or highway freight.',
    icon: '🌱',
    source: 'World Shipping Council'
  },
  {
    id: 'fact-5',
    type: 'fact',
    category: 'CHOKEPOINTS',
    title: 'The Strait of Malacca carries over 85,000 ships per year, connecting the Indian and Pacific Oceans.',
    icon: '🧭',
    source: 'Global Maritime Logistics'
  },
  {
    id: 'fact-6',
    type: 'fact',
    category: 'ENGINEERING',
    title: 'Large 2-stroke marine low-speed diesel engines exceed 50% thermal efficiency, ranking as the most efficient heat engines on Earth.',
    icon: '⚙️',
    source: 'Marine Propulsion Engineering'
  },
  {
    id: 'fact-7',
    type: 'fact',
    category: 'DIGITAL LIFELINE',
    title: 'More than 95% of international internet and telecommunication traffic travels across the ocean floor via submarine fiber cables.',
    icon: '🌐',
    source: 'Submarine Telecoms Forum'
  },
  {
    id: 'fact-8',
    type: 'fact',
    category: 'MEGA SHIPS',
    title: 'The largest ultra-large container vessels (ULCVs) exceed 400 meters in length and carry up to 24,000 twenty-foot containers (TEU).',
    icon: '📦',
    source: 'Maritime Fleet Review'
  }
];

router.get('/', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();

  if (!forceRefresh && cachedItems && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return res.json({
      success: true,
      fromCache: true,
      items: cachedItems,
      updatedAt: lastFetchTime
    });
  }

  const apiKey = (process.env.NEWS_API_KEY || '').replace(/^here/i, '').trim();

  let liveNews = [];

  if (apiKey) {
    try {
      const query = encodeURIComponent('maritime OR shipping OR "marine cargo" OR "ocean freight"');
      const url = `https://api.thenewsapi.com/v1/news/all?api_token=${apiKey}&search=${query}&language=en&limit=8`;
      
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const json = await response.json();
        const articles = json.data || [];
        liveNews = articles.map((a, idx) => ({
          id: `news-${idx}-${a.uuid || Date.now()}`,
          type: 'news',
          category: 'MARITIME DISPATCH',
          title: a.title,
          url: a.url,
          source: a.source || 'News Wire',
          publishedAt: a.published_at,
          icon: '📰'
        }));
      } else {
        console.warn('TheNewsAPI returned status:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch from TheNewsAPI:', err.message);
    }
  }

  // Interweave news articles with marine facts for dynamic diversity
  const combined = [];
  const maxLen = Math.max(liveNews.length, MARINE_FACTS.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < liveNews.length) combined.push(liveNews[i]);
    if (i < MARINE_FACTS.length) combined.push(MARINE_FACTS[i]);
  }

  cachedItems = combined.length > 0 ? combined : MARINE_FACTS;
  lastFetchTime = now;

  res.json({
    success: true,
    fromCache: false,
    items: cachedItems,
    updatedAt: lastFetchTime
  });
});

export default router;
