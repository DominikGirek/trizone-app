import { XMLParser } from 'fast-xml-parser';

import type { Article } from '@/types';

/**
 * Public triathlon RSS feeds. Feeds that fail (offline, moved, blocked) are
 * skipped gracefully so the aggregate still returns whatever loaded.
 *
 * This module runs both server-side (the /api/news route, used by web) and
 * directly on native devices — neither of which is subject to browser CORS.
 */
export const FEEDS: { url: string; source: string; lang: 'de' | 'en' }[] = [
  // German-language sources (audience: German age-groupers)
  { url: 'https://www.tri-mag.de/feed/', source: 'tri-mag', lang: 'de' },
  { url: 'https://www.tri2b.com/feed/', source: 'tri2b.com', lang: 'de' },
  { url: 'https://www.trinews.at/feed/', source: 'triNews', lang: 'de' },
  // English / international magazines
  { url: 'https://www.tri247.com/feed', source: 'Tri247', lang: 'en' },
  { url: 'https://www.triathlete.com/feed/', source: 'Triathlete', lang: 'en' },
  { url: 'https://www.220triathlon.com/feed', source: '220 Triathlon', lang: 'en' },
  { url: 'https://www.slowtwitch.com/feed/', source: 'Slowtwitch', lang: 'en' },
  { url: 'https://triathlonmagazine.ca/feed/', source: 'Triathlon Mag CA', lang: 'en' },
  { url: 'https://scientifictriathlon.com/feed/', source: 'Scientific Triathlon', lang: 'en' },
  { url: 'https://www.witsup.com/feed/', source: 'Witsup', lang: 'en' },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '#text' in value) return String(value['#text']);
  return String(value);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&#039;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImage(item: any): string | undefined {
  const enclosure = item.enclosure?.['@_url'];
  if (enclosure) return enclosure;
  const media = asArray(item['media:content'])[0]?.['@_url'];
  if (media) return media;
  const thumb = item['media:thumbnail']?.['@_url'];
  if (thumb) return thumb;
  const html = textOf(item['content:encoded']) || textOf(item.description);
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

function parseFeed(xml: string, source: string, lang: 'de' | 'en'): Article[] {
  const root = parser.parse(xml);
  const items = asArray(root?.rss?.channel?.item ?? root?.feed?.entry);

  return items.map((item: any, i: number): Article => {
    const link =
      textOf(item.link?.['@_href'] ?? item.link) || item.guid?.['#text'] || textOf(item.guid);
    const rawSummary =
      textOf(item.description) || textOf(item.summary) || textOf(item['content:encoded']);
    const summary = stripHtml(rawSummary).slice(0, 220);
    const published = textOf(item.pubDate) || textOf(item.published) || textOf(item.updated);
    return {
      id: `${source}-${textOf(item.guid) || link || i}`,
      title: stripHtml(textOf(item.title)),
      summary,
      imageUrl: extractImage(item),
      source,
      link: typeof link === 'string' ? link.trim() : '',
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      lang,
    };
  });
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<Article[]> {
  // Per-feed timeout so one slow/dead feed can't stall the whole aggregate.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(feed.url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (TriZone/1.0; +https://trizone.app)',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), feed.source, feed.lang);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Relevant German portals that have NO usable RSS feed (e.g. triathlon.de) — pulled via
// Google News (runs server-side on web → no CORS) so their coverage still shows in the feed.
const GOOGLE_NEWS_SITES: { site: string; source: string }[] = [
  { site: 'triathlon.de', source: 'triathlon.de' },
];

async function fetchSiteNews(site: string, source: string): Promise<Article[]> {
  const arts = await fetchGoogleNews(`site:${site}`);
  return arts.map((a) => ({ ...a, source, lang: 'de' as const }));
}

/** Aggregate, de-duplicate and sort all feeds by recency. */
export async function aggregateFeeds(): Promise<Article[]> {
  const [feedResults, siteResults] = await Promise.all([
    Promise.all(FEEDS.map(fetchFeed)),
    Promise.all(GOOGLE_NEWS_SITES.map((s) => fetchSiteNews(s.site, s.source))),
  ]);
  const all = [...feedResults.flat(), ...siteResults.flat()].filter((a) => a.title && a.link);

  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  return deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

// --- Per-race local/regional news via Google News RSS search ---
// Surfaces coverage from thousands of sources (incl. local papers like
// bbv-net.de) for a specific race — far beyond the curated magazine feeds.

function parseGoogleNews(xml: string): Article[] {
  const root = parser.parse(xml);
  const items = asArray(root?.rss?.channel?.item);
  return items
    .map((item: any, i: number): Article => {
      const rawTitle = stripHtml(textOf(item.title));
      const source = stripHtml(textOf(item.source)) || rawTitle.split(/\s[-–]\s/).pop() || 'News';
      const title =
        source && rawTitle.endsWith(`- ${source}`)
          ? rawTitle.slice(0, -(source.length + 2)).trim()
          : rawTitle.replace(/\s[-–]\s[^-–]+$/, '').trim();
      const link = textOf(item.link?.['@_href'] ?? item.link) || textOf(item.guid);
      const published = textOf(item.pubDate);
      return {
        id: `gn-${textOf(item.guid) || link || i}`,
        title,
        summary: '',
        source,
        link: typeof link === 'string' ? link.trim() : '',
        publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
        lang: 'de',
      };
    })
    .filter((a) => a.title && a.link);
}

/** News for a specific race query (Google News RSS, German). */
export async function fetchGoogleNews(query: string): Promise<Article[]> {
  if (!query.trim()) return [];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=de&gl=DE&ceid=DE:de`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (TriZone/1.0)' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    return parseGoogleNews(await res.text());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
