/**
 * Pro start lists ingest — Stage 2 (IRONMAN / 70.3 / Challenge / T100 via PTO).
 *
 * protriathletes.org is server-rendered, so a plain-Node robot can read it (no
 * headless browser). Strategy, all without an LLM:
 *  1. /pro-race-calendar → upcoming races: name, date, circuit (brand-*), country,
 *     and the /participants URL.
 *  2. /rankings + /rankings/women → slug → ISO-2 country map (~1000 pros, 2 fetches).
 *  3. per upcoming race, /participants → athlete slugs (class="athlete-pic-group",
 *     excludes the nav widget) → build pro athletes (id slug, name from slug,
 *     country from the rankings map, series from the circuit) + a CONFIRMED upcoming
 *     start linking to that exact start list.
 *
 * Covers the four priority circuits. The app merges this on top of curated + WTCS.
 * Writes src/data/proStartsPTO.json. Media start-list articles (triathlon.de …)
 * and announced/"expected" starts from news are separate robots.
 *
 * Usage: node scripts/ingest-pro-starts.mjs [--months=7]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/proStartsPTO.json');
const BASE = 'https://stats.protriathletes.org';
const UA = 'Mozilla/5.0 (TriZone-ProRadar; +https://trizone.app)';
const MONTHS = Number((process.argv.find((a) => a.startsWith('--months=')) || '').split('=')[1]) || 7;

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const MONTH = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};
function parseDate(s) {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mo = MONTH[m[2].toLowerCase()];
  if (!mo) return null;
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}
const titleCase = (slug) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
// brand-* class → our SeriesId (Challenge has no series enum → none)
const SERIES_BY_BRAND = { t100: 't100', im: 'ironman', im703: 'ironman703', '703': 'ironman703', challenge: 'challenge', pto: 'pto' };

// --- Country map from the world rankings (slug → ISO-2) -----------------------
async function buildCountryMap() {
  const map = {};
  for (const url of ['/rankings', '/rankings/women']) {
    const h = (await get(url)) || '';
    for (const m of h.matchAll(/href="\/athlete\/([a-z0-9-]+)"[\s\S]{0,400}?flag-icon flag-icon-([a-z]{2})/g)) {
      if (!map[m[1]]) map[m[1]] = m[2].toUpperCase();
    }
  }
  return map;
}

// --- Upcoming races from the pro race calendar -------------------------------
function parseCalendar(html, now, until) {
  const blocks = html.split(/class="event sortable-item/).slice(1);
  const races = [];
  for (const b of blocks) {
    const link = b.match(/href="\/race\/([a-z0-9-]+)\/(\d{4})\/participants">([^<]+)</);
    if (!link) continue;
    const dateRaw = (b.match(/col-date[^>]*>([^<]+)</) || [])[1] || '';
    const date = parseDate(dateRaw);
    if (!date) continue;
    const t = +new Date(date);
    if (t < now || t > until) continue; // upcoming, bounded
    const brand = (b.match(/brand-([a-z0-9]+)/) || [])[1];
    const country = (b.match(/flag-icon flag-icon-([a-z]{2})/) || [])[1];
    races.push({
      slug: link[1],
      year: link[2],
      name: link[3].trim(),
      date,
      series: SERIES_BY_BRAND[brand],
      country: country ? country.toUpperCase() : undefined,
    });
  }
  return races;
}

async function main() {
  const now = Date.now() - 864e5; // include today
  const until = now + MONTHS * 31 * 864e5;

  const countryMap = await buildCountryMap();
  console.log(`Country map: ${Object.keys(countryMap).length} ranked pros`);

  const calHtml = (await get('/pro-race-calendar')) || '';
  const races = parseCalendar(calHtml, now, until);
  console.log(`Upcoming races in the next ${MONTHS} months: ${races.length}`);

  const athletes = new Map();
  const starts = new Map();

  for (const race of races) {
    const h = await get(`/race/${race.slug}/${race.year}/participants`);
    if (!h) {
      console.log(`· ${race.name}: participants fetch failed`);
      continue;
    }
    const slugs = [...new Set([...h.matchAll(/href="\/athlete\/([a-z0-9-]+)" class="athlete-pic-group/g)].map((m) => m[1]))];
    if (!slugs.length) {
      console.log(`· ${race.name} (${race.date}): start list not published yet`);
      continue;
    }
    for (const slug of slugs) {
      if (!athletes.has(slug)) {
        athletes.set(slug, {
          id: slug,
          name: titleCase(slug),
          country: countryMap[slug] || '',
          // gender unknown from this source; left for WTCS/curated to fill
          series: race.series ? [race.series] : [],
        });
      } else if (race.series) {
        const a = athletes.get(slug);
        if (!a.series.includes(race.series)) a.series.push(race.series);
      }
      const list = starts.get(slug) || [];
      list.push({
        date: race.date,
        event: race.name,
        ...(race.series ? { series: race.series } : {}),
        ...(race.country ? { location: race.country } : {}),
        url: `${BASE}/race/${race.slug}/${race.year}/participants`,
        confidence: 'confirmed',
      });
      starts.set(slug, list);
    }
    console.log(`· ${race.name} (${race.date}): ${slugs.length} pros`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    note: 'Pro athletes + CONFIRMED upcoming starts scraped from protriathletes.org participant lists (IRONMAN / 70.3 / Challenge / T100). Server-rendered, no headless browser, no LLM. Country from the PTO world ranking. Merged on top of curated + WTCS (those win). Regenerated by the pipeline; do not hand-edit.',
    athletes: [...athletes.values()].sort((a, b) => a.name.localeCompare(b.name)),
    starts: Object.fromEntries(starts),
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${out.athletes.length} pro athletes (+ confirmed starts) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
