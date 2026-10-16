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

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]{1,4});/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]{1,4});/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function categorizeArticle(title, source) {
  const text = (title + ' ' + (source || '')).toLowerCase();
  if (text.includes('tradewinds')) return { category: 'TRADEWINDS', icon: '🚢' };
  if (/tanker|crude|oil|lng|lpg|gas carrier|vlcc/i.test(text)) return { category: 'TANKER & ENERGY', icon: '⛽' };
  if (/container|boxship|teu|freight rate|liner/i.test(text)) return { category: 'CONTAINER FREIGHT', icon: '📦' };
  if (/bulk|capesize|panamax|supramax|ultramax|ore|grain/i.test(text)) return { category: 'DRY BULK TRADE', icon: '🏗️' };
  if (/port|terminal|dock|canal|suez|panama|red sea|strait|chokepoint/i.test(text)) return { category: 'PORTS & ROUTES', icon: '⚓' };
  if (/green|decarboni|emission|methanol|ammonia|electric|wind/i.test(text)) return { category: 'GREEN SHIPPING', icon: '🌱' };
  return { category: 'OCEAN TRADE', icon: '🌊' };
}

async function fetchGoogleMarineNews() {
  const query = encodeURIComponent('site:tradewindsnews.com OR "ocean trade" OR "maritime shipping" OR "container shipping" OR "dry bulk trade"');
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Google News RSS returned status ${response.status}`);
  }

  const xml = await response.text();
  const articles = [];
  const itemRegex = /<item>[\s\S]*?<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && articles.length < 20) {
    const itemXml = match[0];
    const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemXml);
    const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(itemXml);
    const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(itemXml);
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(itemXml);

    if (titleMatch && linkMatch) {
      let rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      rawTitle = decodeHtmlEntities(rawTitle);

      let source = sourceMatch ? decodeHtmlEntities(sourceMatch[1].trim()) : '';
      if (!source && rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        source = parts.pop().trim();
        rawTitle = parts.join(' - ').trim();
      } else if (source && rawTitle.endsWith(` - ${source}`)) {
        rawTitle = rawTitle.slice(0, rawTitle.length - (source.length + 3)).trim();
      }

      const { category, icon } = categorizeArticle(rawTitle, source);

      articles.push({
        id: `news-${articles.length}-${Date.now()}`,
        type: 'news',
        category,
        icon,
        title: rawTitle,
        url: linkMatch[1].trim(),
        source: source || 'TradeWinds / Ocean Trade',
        publishedAt: pubDateMatch ? pubDateMatch[1].trim() : ''
      });
    }
  }

  return articles;
}

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

  let liveNews = [];

  // 1. Try Google News RSS targeted to TradeWinds & Ocean Trade
  try {
    liveNews = await fetchGoogleMarineNews();
  } catch (err) {
    console.warn('Google News maritime RSS fetch error:', err.message);
  }

  // 2. If Google News returned no items, try TheNewsAPI fallback if configured
  if (liveNews.length === 0) {
    const apiKey = (process.env.NEWS_API_KEY || '').replace(/^here/i, '').trim();
    if (apiKey) {
      try {
        const query = encodeURIComponent('maritime OR shipping OR "marine cargo" OR "ocean freight"');
        const url = `https://api.thenewsapi.com/v1/news/all?api_token=${apiKey}&search=${query}&language=en&limit=10`;
        const resp = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
        if (resp.ok) {
          const json = await resp.json();
          liveNews = (json.data || []).map((a, idx) => {
            const { category, icon } = categorizeArticle(a.title, a.source);
            return {
              id: `news-tna-${idx}-${a.uuid || Date.now()}`,
              type: 'news',
              category,
              title: a.title,
              url: a.url,
              source: a.source || 'Maritime Wire',
              publishedAt: a.published_at,
              icon
            };
          });
        }
      } catch (e) {
        console.warn('TheNewsAPI fallback fetch error:', e.message);
      }
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
