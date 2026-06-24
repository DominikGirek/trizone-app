/**
 * IRONMAN Pro Series start lists — plain-Node ingest (no headless browser).
 *
 * ironman.com exposes a per-race, SERVER-RENDERED pro starter list at
 *   /proseries/races/{slug}/starters-men  and  /starters-women
 * (the names are in the HTML). So a simple fetch reads them — no Playwright, no API
 * reverse-engineering, no Cloudflare-automation. The full set of Pro Series race slugs
 * is listed in the IRONMAN sitemap.
 *
 * Per race: fetch the men's + women's starter pages, pull capitalized name n-grams, and
 * keep only names in our VERIFIED-PRO roster (WTCS/PTO/media/curated + the official PTO
 * World Ranking) — never age groupers. Gender comes from which page (men/women), the
 * date/name from matching our series events. Accumulates onto the committed file, dedups
 * per athlete by date, prunes past races.
 *
 * Usage: node scripts/ingest-pro-starts-ironman.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/proStartsIronman.json');
const BASE = 'https://www.ironman.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nameKey = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
const GENERIC = new Set(['ironman', 'im', 'im703', 'world', 'championship', 'european', 'france', 'switzerland', 'austria', 'series', 'pro']);
const cityToks = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((t) => t.length > 3 && !/^\d+$/.test(t) && !GENERIC.has(t));

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    return r.ok ? await r.text() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

// nameKey → { id, name, country } for every verified pro (incl. the PTO World Ranking).
async function knownRoster() {
  const map = new Map();
  const add = (name, id, country = '') => { const k = nameKey(name); if (k.includes(' ') && id && !map.has(k)) map.set(k, { id, name, country }); };
  for (const f of ['src/data/proAthletes.json', 'src/data/proStartsPTO.json', 'src/data/proStartsMedia.json']) {
    try { for (const a of JSON.parse(await readFile(resolve(ROOT, f), 'utf8')).athletes ?? []) add(a.name, a.id, a.country || ''); } catch { /* */ }
  }
  const mocks = await readFile(resolve(ROOT, 'src/mocks/athletes.ts'), 'utf8').catch(() => '');
  for (const m of mocks.matchAll(/id: '([^']+)',\s*name: '([^']+)'[\s\S]*?country: '([^']+)'/g)) add(m[2], m[1], m[3]);
  for (const url of ['https://stats.protriathletes.org/rankings', 'https://stats.protriathletes.org/rankings/women']) {
    const h = await get(url);
    for (const m of h.matchAll(/href="\/athlete\/([a-z0-9-]+)"[\s\S]{0,400}?flag-icon flag-icon-([a-z]{2})/g)) add(m[1].replace(/-/g, ' '), m[1], m[2].toUpperCase());
    for (const m of h.matchAll(/href="\/athlete\/([a-z0-9-]+)"/g)) add(m[1].replace(/-/g, ' '), m[1]);
  }
  console.log(`Verified-pro roster: ${map.size} names`);
  return map;
}

// Our series races (for the canonical date + display name), matched by city token.
async function seriesRaces() {
  const src = await readFile(resolve(ROOT, 'src/mocks/seriesEvents.ts'), 'utf8').catch(() => '');
  const out = [];
  for (const m of src.matchAll(/name:\s*'([^']+)'[\s\S]*?town:\s*'([^']+)'[\s\S]*?date:\s*'([^']+)'/g)) {
    out.push({ name: m[1], town: m[2], date: m[3].slice(0, 10), toks: new Set([...cityToks(m[1]), ...cityToks(m[2])]) });
  }
  return out;
}

// All IRONMAN Pro Series race slugs from the sitemap (base slug, no -men/-women suffix).
async function proseriesSlugs() {
  const slugs = new Set();
  for (const p of [1, 2, 3, 4, 5]) {
    const xml = await get(`${BASE}/sitemap.xml?page=${p}`);
    for (const m of xml.matchAll(/proseries\/races\/([a-z0-9-]+?)(?:\/starters-(?:men|women))?(?=["<\s])/g)) {
      slugs.add(m[1].replace(/-(?:men|women)$/, ''));
    }
  }
  return [...slugs];
}

// Pull the starters out of a server-rendered Pro Series starter page. Each starter is a
// `vertical-card-athlete` card linking to /proseries/triathletes/{slug} — this IS the
// official pro field, so no roster gate is needed (every card is a pro by definition);
// the roster only enriches the country / canonical id when we already know the athlete.
function prosOnPage(html, roster) {
  const out = [];
  const seen = new Set();
  for (const c of html.split(/vertical-card-athlete/).slice(1)) {
    const m = c.match(/\/proseries\/triathletes\/([a-z0-9-]+)"[^>]*>([^<]+)</);
    if (!m) continue;
    const name = m[2].trim();
    const known = roster.get(nameKey(name));
    const id = known?.id || m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, country: known?.country || '' });
  }
  return out;
}

async function main() {
  // DISABLED: ironman.com Terms of Use forbid automated access/scraping ("any robot,
  // spider, web crawler, extraction software, automated process … to scrape, copy, or
  // monitor any portion of the Site", and personal non-commercial use only). We do NOT
  // scrape ironman.com. IRONMAN-race fields come from third-party media instead.
  // (Left in place, guarded, in case of a future data licence — set TRIZONE_ALLOW_IRONMAN=1.)
  if (process.env.TRIZONE_ALLOW_IRONMAN !== '1') {
    console.log('IRONMAN ingest disabled (ironman.com ToS forbids automated access) — no-op.');
    return;
  }
  const now = Date.now() - 864e5;
  const todayISO = new Date(now).toISOString().slice(0, 10);
  const roster = await knownRoster();
  const series = await seriesRaces();
  const slugs = await proseriesSlugs();
  console.log(`IRONMAN Pro Series races: ${slugs.length}`);

  const starts = {};
  const minted = new Map();

  for (const slug of slugs) {
    const seriesId = /^im703/.test(slug) ? 'ironman703' : 'ironman';
    const toks = cityToks(slug.replace(/^im703?-/, '').replace(/-/g, ' '));
    const match = series.find((r) => toks.some((c) => r.toks.has(c)));
    if (!match) { console.log(`· ${slug}: no matching series event (no date) → skip`); continue; }

    let n = 0;
    for (const gender of ['men', 'women']) {
      const url = `${BASE}/proseries/races/${slug}/starters-${gender}`;
      let html = await get(url);
      if (!/vertical-card-athlete/.test(html)) { await sleep(4000); html = await get(url); } // throttled? retry
      await sleep(1500); // be polite → avoid rate limiting
      if (!html) continue;
      for (const a of prosOnPage(html, roster)) {
        if (!minted.has(a.id)) minted.set(a.id, { id: a.id, name: a.name, country: a.country || '', gender, series: [seriesId] });
        const list = (starts[a.id] ??= []);
        if (!list.some((s) => s.date === match.date)) {
          list.push({ date: match.date, event: match.name, series: seriesId, location: match.town, url: `${BASE}/proseries/races/${slug}/starters-${gender}`, confidence: 'confirmed' });
          n++;
        }
      }
    }
    console.log(`· ${slug} → ${match.name} (${match.date}): ${n} verified pros`);
  }

  // Accumulate onto the committed file; dedup per athlete by date; prune past races.
  const prevRaw = await readFile(OUT, 'utf8').catch(() => '');
  let prev = {};
  try { prev = JSON.parse(prevRaw); } catch { /* */ }
  const athletesById = new Map();
  for (const a of prev.athletes ?? []) athletesById.set(a.id, a);
  for (const a of minted.values()) {
    const ex = athletesById.get(a.id);
    if (!ex) athletesById.set(a.id, a);
    else { ex.series = [...new Set([...(ex.series ?? []), ...(a.series ?? [])])]; if (!ex.gender && a.gender) ex.gender = a.gender; }
  }
  const mergedStarts = {};
  for (const id of new Set([...Object.keys(prev.starts ?? {}), ...Object.keys(starts)])) {
    const byDate = new Map();
    for (const s of [...(prev.starts?.[id] ?? []), ...(starts[id] ?? [])]) {
      if (s.date >= todayISO && !byDate.has(s.date)) byDate.set(s.date, s);
    }
    if (byDate.size) mergedStarts[id] = [...byDate.values()];
  }
  const keptAthletes = [...athletesById.values()].filter((a) => mergedStarts[a.id]);

  const out = {
    generatedAt: new Date().toISOString(),
    note: 'Pro athletes + CONFIRMED starts read from ironman.com Pro Series starter pages (/proseries/races/{slug}/starters-men|women, server-rendered). Verified against the pro roster (WTCS/PTO/media/curated + the official PTO World Ranking) — no age groupers. Gender from the men/women page. Accumulated across runs, pruned to future races. Merged under curated/WTCS/PTO/media. Regenerated by the pipeline; do not hand-edit.',
    athletes: keptAthletes.sort((a, b) => a.name.localeCompare(b.name)),
    starts: mergedStarts,
  };
  const stripDate = (raw) => { try { const o = JSON.parse(raw); delete o.generatedAt; return JSON.stringify(o); } catch { return raw; } };
  if (stripDate(JSON.stringify(out)) !== stripDate(prevRaw)) await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  const total = Object.values(mergedStarts).reduce((s, l) => s + l.length, 0);
  console.log(`\nTotal ${total} starts / ${keptAthletes.length} athletes → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
