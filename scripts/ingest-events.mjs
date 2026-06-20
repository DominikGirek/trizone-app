#!/usr/bin/env node
/**
 * TriZone — Event-History-Index ingester.
 *
 * The DTU calendar LIST is forward-only (no past events), but event DETAIL pages
 * stay reachable by id (show/{id}) long after the event has passed. This script
 * walks a window of ids below the newest one, keeps the FINISHED events of the
 * last 12 months, and writes a real index (src/data/eventIndex.json) that the
 * app reads to populate the "Vergangene" tab. Tapping a past event opens the
 * existing /local/[id] screen, which re-fetches the detail live (incl. ticker).
 *
 * Everything is real, scraped data — no fabricated dates. Re-run daily (cron /
 * GitHub Action) so newly-passed events accumulate over time. See docs/event-index.md.
 *
 * Usage:
 *   node scripts/ingest-events.mjs                 # default window
 *   node scripts/ingest-events.mjs --window=800    # scan more ids (deeper backfill)
 *   node scripts/ingest-events.mjs --months=12     # keep window (months back)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/eventIndex.json');

const LIST_URL = 'https://www.dtu-kalender.de/event/sport/list';
const SHOW_URL = (id) => `https://www.dtu-kalender.de/event/sport/show/${id}`;
const UA = 'Mozilla/5.0 (TriZone/1.0)';

const argNum = (name, def) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? Number(m.split('=')[1]) : def;
};
const WINDOW = argNum('window', 600);
const MONTHS = argNum('months', 12);
const CONCURRENCY = 6;

// --- Parsers (kept in sync with src/services/dtu.ts) ---------------------------
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;|&#8211;/g, '–');
}
const stripTags = (html) =>
  decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function deDateToISO(d) {
  const m = d?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return undefined;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 9, 0, 0).toISOString();
}
const cleanTown = (t) => t.replace(/\(.*?\)/g, '').split(',')[0].trim();

const REGION_CENTROIDS = {
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

function valueAfterLabel(lines, label) {
  const i = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  return i >= 0 && i + 1 < lines.length ? lines[i + 1] : undefined;
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/^\d+\.?\s*/, '') // drop leading edition number ("19. ")
    .replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c]))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- HTTP --------------------------------------------------------------------
async function fetchText(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: ctrl.signal });
    return r.ok ? await r.text() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    process.stdout.write('.');
  }
  process.stdout.write('\n');
}

/** Parse one DTU detail page into an event stub, or undefined. */
async function fetchDetail(id) {
  const html = await fetchText(SHOW_URL(id), {
    headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: LIST_URL },
  });
  if (!html) return undefined;
  // Split on block boundaries FIRST, then collapse whitespace per line — doing it
  // globally (stripTags) would flatten newlines and break label lookup.
  const lines = decodeEntities(html.replace(/<\/(div|td|tr|p|h\d|li)>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const name = valueAfterLabel(lines, 'Veranstaltungsname') ?? '';
  const iso = deDateToISO(html);
  if (!name || !iso) return undefined;
  const organizer = valueAfterLabel(lines, 'Veranstalter');
  const ortLine = valueAfterLabel(lines, 'Ort') ?? '';
  const town = cleanTown(ortLine.replace(/^\d{5}\s*/, '')) || ortLine;
  const region = Object.keys(REGION_CENTROIDS).find((r) => html.includes(r)) ?? '';
  const c = REGION_CENTROIDS[region] ?? GERMANY;
  return {
    id: String(id),
    name,
    town: town || '—',
    region,
    country: 'DE',
    lat: c.lat,
    lon: c.lon,
    date: iso,
    distances: [],
    organizer,
    websiteUrl: SHOW_URL(String(id)),
    provider: 'other',
    slug: slugify(name),
  };
}

// --- Main --------------------------------------------------------------------
async function loadExisting() {
  try {
    const json = JSON.parse(await readFile(OUT, 'utf8'));
    return Array.isArray(json?.events) ? json : { events: [], editions: {} };
  } catch {
    return { events: [], editions: {} };
  }
}

async function main() {
  const cutoff = Date.now() - MONTHS * 31 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const first = (await fetchText(`${LIST_URL}?page=1`)) ?? '';
  const listIds = [...first.matchAll(/show\/(\d+)/g)].map((m) => Number(m[1]));
  if (!listIds.length) {
    console.error('Could not read DTU list — aborting (keeping existing index).');
    process.exit(1);
  }
  const maxId = Math.max(...listIds);
  const scanIds = Array.from({ length: WINDOW }, (_, i) => maxId - 1 - i).filter((n) => n > 0);
  console.log(`DTU max id ${maxId} → scanning ${scanIds.length} ids back, keeping finished events of last ${MONTHS} months…`);

  const found = [];
  await inBatches(scanIds, CONCURRENCY, async (id) => {
    const ev = await fetchDetail(id);
    if (!ev) return;
    const t = +new Date(ev.date);
    if (t < now && t >= cutoff) found.push(ev); // finished (past) & within window
  });

  // Merge with existing index (forward accumulation), dedupe by id, prune > window.
  const existing = await loadExisting();
  const byId = new Map();
  for (const e of existing.events) if (+new Date(e.date) >= cutoff) byId.set(e.id, e);
  for (const e of found) byId.set(e.id, e); // fresh scan wins
  const events = [...byId.values()].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const out = { generatedAt: new Date().toISOString(), events, editions: existing.editions ?? {} };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 0) + '\n');
  console.log(`\nWrote ${events.length} past events → ${OUT} (${found.length} from this scan).`);
}

main();
