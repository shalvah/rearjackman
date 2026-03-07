const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string | null; // raw string from feed, formatted for display
}

export interface Feed {
  name: string;
  items: FeedItem[];
  error?: string;
}

const FEEDS: { name: string; url: string }[] = [
  { name: 'Autosport',      url: 'https://www.autosport.com/rss/f1/news' },
  { name: 'The Race',       url: 'https://the-race.com/feed/' },
  { name: 'BBC Sport F1',   url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
  { name: 'Motorsport.com', url: 'https://www.motorsport.com/rss/f1/news' },
];

// Extract the text content of the first matching XML tag
function xmlText(xml: string, tag: string): string | null {
  // Handle both <tag>text</tag> and <tag><![CDATA[text]]></tag>
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return null;
  return (m[1] ?? m[2] ?? '').trim();
}

// Decode common HTML/XML entities
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function formatPubDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseRss(xml: string, limit = 10): FeedItem[] {
  const items: FeedItem[] = [];
  // Split on <item> boundaries
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = decodeEntities(xmlText(block, 'title') ?? '');
    const link  = xmlText(block, 'link') ?? xmlText(block, 'guid') ?? '';
    const pubDate = formatPubDate(xmlText(block, 'pubDate'));
    if (title && link) {
      items.push({ title, link, pubDate });
    }
  }
  return items;
}

async function fetchFeed(name: string, url: string): Promise<Feed> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RearJackMan/1.0 (rearjackman.com)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { name, items: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    return { name, items: parseRss(xml) };
  } catch (e) {
    return { name, items: [], error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}

export async function fetchAllFeeds(cache: KVNamespace): Promise<Feed[]> {
  const CACHE_KEY = 'news:feeds';

  // Try KV cache first
  const cached = await cache.get(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as Feed[];
    } catch {
      // fall through to re-fetch
    }
  }

  // Fetch all feeds in parallel
  const feeds = await Promise.all(FEEDS.map((f) => fetchFeed(f.name, f.url)));

  // Store in KV with TTL (fire-and-forget)
  cache.put(CACHE_KEY, JSON.stringify(feeds), { expirationTtl: CACHE_TTL_SECONDS });

  return feeds;
}
