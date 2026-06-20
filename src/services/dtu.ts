import type { LocalEvent, TimingProvider } from '@/types';

/**
 * Ingestion of the public DTU event calendar (dtu-kalender.de, robots: allow).
 * Server-rendered HTML, parsed defensively. Runs both server-side (the
 * /api/local-events route, for web) and directly on native (no CORS).
 * Coordinates come from the free open-meteo geocoding API.
 */
const LIST_URL = 'https://www.dtu-kalender.de/event/sport/list';
const SHOW_URL = (id: string) => `https://www.dtu-kalender.de/event/sport/show/${id}`;
const UA = 'Mozilla/5.0 (TriZone/1.0)';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;|&#8211;/g, '–');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function deDateToISO(d?: string): string | undefined {
  const m = d?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return undefined;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 9, 0, 0).toISOString();
}

function statusFor(iso: string): LocalEvent['status'] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day < now) return 'finished';
  if (+day === +now) return 'live';
  return 'upcoming';
}

// Bundesland centroids → fast, API-free coordinates for the whole calendar
// (used for list/near-me sorting). The detail page geocodes the exact town.
const REGION_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  'Baden-Württemberg': { lat: 48.66, lon: 9.35 },
  Bayern: { lat: 48.79, lon: 11.5 },
  Berlin: { lat: 52.52, lon: 13.4 },
  Brandenburg: { lat: 52.13, lon: 13.2 },
  Bremen: { lat: 53.08, lon: 8.8 },
  Hamburg: { lat: 53.55, lon: 10.0 },
  Hessen: { lat: 50.65, lon: 9.16 },
  'Mecklenburg-Vorpommern': { lat: 53.61, lon: 12.43 },
  Niedersachsen: { lat: 52.64, lon: 9.85 },
  'Nordrhein-Westfalen': { lat: 51.43, lon: 7.66 },
  'Rheinland-Pfalz': { lat: 49.91, lon: 7.45 },
  Saarland: { lat: 49.38, lon: 6.96 },
  Sachsen: { lat: 51.1, lon: 13.2 },
  'Sachsen-Anhalt': { lat: 51.95, lon: 11.69 },
  'Schleswig-Holstein': { lat: 54.22, lon: 9.7 },
  Thüringen: { lat: 50.9, lon: 11.03 },
};
const GERMANY = { lat: 51.16, lon: 10.45 };
const centroidOf = (region: string) => REGION_CENTROIDS[region.trim()] ?? GERMANY;

// --- Geocoding (cached per process / session) — used for precise detail page ---
const geoCache = new Map<string, { lat: number; lon: number } | null>();

function cleanTown(town: string): string {
  return town.replace(/\(.*?\)/g, '').split(',')[0].trim();
}

async function geocode(town: string): Promise<{ lat: number; lon: number } | null> {
  const key = cleanTown(town);
  if (geoCache.has(key)) return geoCache.get(key)!;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(key)}&count=1&language=de&country=DE`,
    );
    const json = await res.json();
    const r = json?.results?.[0];
    const coords = r ? { lat: r.latitude, lon: r.longitude } : null;
    geoCache.set(key, coords);
    return coords;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

interface ListRow {
  id: string;
  name: string;
  region: string;
  town: string;
  iso?: string;
}

function parseListRows(html: string): ListRow[] {
  const rows = html.split(/<tr[ >]/i).slice(1);
  const out: ListRow[] = [];
  for (const r of rows) {
    const m = r.match(/show\/(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/i);
    if (!m) continue;
    const tds = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => stripTags(x[1]));
    const dateIdx = tds.findIndex((t) => /\d{2}\.\d{2}\.\d{4}/.test(t));
    if (dateIdx < 2) continue;
    out.push({
      id: m[1],
      name: stripTags(m[2]),
      region: tds[dateIdx - 2],
      town: tds[dateIdx - 1],
      iso: deDateToISO(tds[dateIdx]),
    });
  }
  return out;
}

function fetchPage(page: number): Promise<string> {
  return fetch(`${LIST_URL}?page=${page}`, { headers: { 'User-Agent': UA } })
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '');
}

/** Fetch pages in bounded-concurrency batches (avoid hammering the server). */
async function fetchPages(pages: number[], batch = 8): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < pages.length; i += batch) {
    out.push(...(await Promise.all(pages.slice(i, i + batch).map(fetchPage))));
  }
  return out;
}

/**
 * Fetch & normalize the COMPLETE DTU event calendar (all pages), so every
 * German event shows up. Coordinates come from the Bundesland centroid (no
 * per-town API calls), which is enough for list/near-me sorting; the detail
 * page geocodes the exact town for weather & map.
 */
export async function ingestLocalEvents(maxPages = 40): Promise<LocalEvent[]> {
  const first = await fetchPage(1);
  const maxLinked = Math.max(1, ...[...first.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1])));
  const lastPage = Math.min(maxLinked, maxPages);

  const restHtml = lastPage > 1 ? await fetchPages(Array.from({ length: lastPage - 1 }, (_, i) => i + 2)) : [];
  const rows = [first, ...restHtml].flatMap(parseListRows).filter((r) => r.iso);

  const seen = new Set<string>();
  const events: LocalEvent[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const c = centroidOf(r.region);
    events.push({
      id: r.id,
      name: r.name,
      town: cleanTown(r.town),
      region: r.region,
      country: 'DE',
      lat: c.lat,
      lon: c.lon,
      date: r.iso!,
      status: statusFor(r.iso!),
      distances: [],
      websiteUrl: SHOW_URL(r.id),
      provider: 'other',
    });
  }
  events.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return events;
}

function valueAfterLabel(lines: string[], label: string): string | undefined {
  const i = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  return i >= 0 && i + 1 < lines.length ? lines[i + 1] : undefined;
}

// A real live/results ticker: a raceresult event page (numeric id) or a
// racepedia / MIKA timing page. (Plain raceresult.com marketing pages excluded.)
const TICKER_RE =
  /https?:\/\/(?:my\.)?raceresult\.com\/\d+[^\s"'<>]*|https?:\/\/[^\s"'<>]*(?:racepedia|mikatiming)[^\s"'<>]*/i;

function providerForUrl(u: string): TimingProvider {
  return /racepedia/i.test(u) ? 'racepedia' : /raceresult/i.test(u) ? 'raceresult' : 'other';
}

async function fetchText(url: string, ms = 8000): Promise<string | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    return r.ok ? await r.text() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Find a timing-provider live/results link on a page (e.g. the organizer site). */
async function findTickerOnPage(url: string): Promise<string | undefined> {
  const html = await fetchText(url);
  const m = html?.match(TICKER_RE);
  return m ? m[0].replace(/["'#).,]+$/, '') : undefined;
}

/**
 * Guard against linking the wrong (e.g. previous-year) edition:
 *  • racepedia uses a year subdomain ("…-2026.racepedia.de") → compare the year.
 *  • raceresult event pages carry the date in <title> ("…, YYYY-MM-DD").
 * Reject only on a CONFIRMED mismatch; if we can't tell (network/parse) we trust
 * the link, since it came from the event's own organizer page.
 */
async function tickerMatchesEvent(url: string, eventIso?: string): Promise<boolean> {
  if (!eventIso) return true;
  const year = eventIso.slice(0, 4);
  const rpYear = url.match(/(\d{4})\.racepedia/i)?.[1];
  if (rpYear) return rpYear === year;
  const rrId = url.match(/raceresult\.com\/(\d+)/i)?.[1];
  if (rrId) {
    const html = await fetchText(`https://my.raceresult.com/${rrId}/`);
    const found = html?.match(/<title>[^<]*?,\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    return !found || found === eventIso.slice(0, 10);
  }
  return true;
}

/** Fetch & enrich a single event detail (organizer, website, live ticker). */
export async function ingestLocalEventDetail(id: string): Promise<LocalEvent | undefined> {
  const res = await fetch(SHOW_URL(id), {
    headers: {
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: LIST_URL,
    },
  });
  if (!res.ok) return undefined;
  const html = await res.text();
  if (!html) return undefined;

  // Split on block boundaries FIRST, then collapse whitespace per line — doing it
  // globally (stripTags) flattens the newlines and breaks the label lookup, which
  // matters for past events where the list base name isn't available.
  const lines = decodeEntities(html.replace(/<\/(div|td|tr|p|h\d|li)>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const name = valueAfterLabel(lines, 'Veranstaltungsname') ?? '';
  const organizer = valueAfterLabel(lines, 'Veranstalter');
  const ortLine = valueAfterLabel(lines, 'Ort') ?? '';
  const town = cleanTown(ortLine.replace(/^\d{5}\s*/, '')) || ortLine;
  const iso = deDateToISO(html);

  const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
  // First external, non-DTU/social/timing link = organizer website.
  const website = links.find(
    (u) => !/dtu-kalender|facebook|instagram|twitter|google|youtube|t-online|racepedia|raceresult|mikatiming/i.test(u),
  );

  // Live/results ticker: prefer a timing link on the DTU page; otherwise scan
  // the organizer's own site (that's where most races link their ticker). Either
  // source belongs to THIS event — we never guess. raceresult links are then
  // date-verified to rule out an old edition.
  let ticker = links.find((u) => TICKER_RE.test(u));
  if (!ticker && website) ticker = await findTickerOnPage(website);
  if (ticker && !(await tickerMatchesEvent(ticker, iso ?? undefined))) ticker = undefined;

  const coords = await geocode(town || name);
  return {
    id,
    name: name || town || `Event ${id}`,
    town: town || '—',
    region: '',
    country: 'DE',
    lat: coords?.lat ?? 51.16,
    lon: coords?.lon ?? 10.45,
    date: iso ?? new Date().toISOString(),
    status: iso ? statusFor(iso) : 'upcoming',
    distances: [],
    organizer,
    websiteUrl: website ?? SHOW_URL(id),
    resultsUrl: ticker,
    provider: ticker ? providerForUrl(ticker) : 'other',
  };
}
