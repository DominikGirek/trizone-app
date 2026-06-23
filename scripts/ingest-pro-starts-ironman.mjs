/**
 * IRONMAN pro start lists — headless-browser ingest (Playwright).
 *
 * ironman.com race pages render the pro field client-side (Nuxt/Vue behind Cloudflare):
 * the list is NOT in the static HTML and there is no public JSON API we could fetch
 * directly (all guessed endpoints 404). So we drive a real Chromium, let the page load
 * its data, and CAPTURE the XHR JSON responses — then pick the response that is the start
 * list (the one with the most names matching our verified-pro roster) and read it. No DOM
 * selectors (robust to layout changes) and no LLM (the payload is structured → no cost).
 *
 * Verified-pro gate: only names in our roster (WTCS/PTO/media/curated + the official PTO
 * World Ranking) are kept — never age groupers. Accumulates onto the committed file,
 * dedup per athlete by date, prunes past races. Gated on Playwright being installed.
 *
 * The FIRST run is also reconnaissance: it logs every captured JSON response URL + the
 * shape of the best candidate so we can tighten the parser if IRONMAN's payload is odd.
 *
 * Usage: node scripts/ingest-pro-starts-ironman.mjs   (needs `playwright` + chromium)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/proStartsIronman.json');
const SEEN = resolve(ROOT, 'src/data/ironmanSeenRaces.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const MAX_RACES = Number(process.env.TRIZONE_IM_MAX || 10); // pages rendered per run
const RACE_WINDOW_DAYS = 120;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const nameKey = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => s.split(/[\s-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

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

// --- Verified-pro roster: our athletes + the official PTO World Ranking ---------
async function knownRoster() {
  const map = new Map(); // nameKey → { id, name, country }
  const add = (name, id, country = '') => {
    const k = nameKey(name);
    if (k.includes(' ') && id && !map.has(k)) map.set(k, { id, name, country });
  };
  for (const f of ['src/data/proAthletes.json', 'src/data/proStartsPTO.json', 'src/data/proStartsMedia.json']) {
    try {
      for (const a of JSON.parse(await readFile(resolve(ROOT, f), 'utf8')).athletes ?? []) add(a.name, a.id, a.country || '');
    } catch { /* */ }
  }
  const mocks = await readFile(resolve(ROOT, 'src/mocks/athletes.ts'), 'utf8').catch(() => '');
  for (const m of mocks.matchAll(/id: '([^']+)',\s*name: '([^']+)'[\s\S]*?country: '([^']+)'/g)) add(m[2], m[1], m[3]);
  for (const url of ['https://stats.protriathletes.org/rankings', 'https://stats.protriathletes.org/rankings/women']) {
    const h = await get(url);
    for (const m of h.matchAll(/href="\/athlete\/([a-z0-9-]+)"[\s\S]{0,400}?flag-icon flag-icon-([a-z]{2})/g)) {
      add(m[1].replace(/-/g, ' '), m[1], m[2].toUpperCase());
    }
    for (const m of h.matchAll(/href="\/athlete\/([a-z0-9-]+)"/g)) add(m[1].replace(/-/g, ' '), m[1]);
  }
  console.log(`Verified-pro roster: ${map.size} names`);
  return map;
}

// --- Series races (IRONMAN / 70.3) the app shows, matched to ironman.com race URLs ---
const MONTH_MS = 864e5;
async function targetRaces(now) {
  const src = await readFile(resolve(ROOT, 'src/mocks/seriesEvents.ts'), 'utf8').catch(() => '');
  const SMAP = { 'IRONMAN 70.3': 'ironman703', IRONMAN: 'ironman' };
  const races = [];
  for (const m of src.matchAll(/name:\s*'([^']+)'[\s\S]*?series:\s*'([^']+)'[\s\S]*?date:\s*'([^']+)'/g)) {
    const series = SMAP[m[2]];
    if (!series) continue; // only IRONMAN/70.3
    const date = m[3].slice(0, 10);
    const t = +new Date(date);
    if (t < now || t > now + RACE_WINDOW_DAYS * MONTH_MS) continue;
    races.push({ name: m[1], date, series });
  }
  // ironman.com race URLs from the sitemap (pages 2-4 hold the races).
  const urls = new Set();
  for (const p of [2, 3, 4]) {
    const xml = await get(`https://www.ironman.com/sitemap.xml?page=${p}`);
    for (const u of xml.matchAll(/https:\/\/www\.ironman\.com\/races\/[a-z0-9-]+/g)) urls.add(u[0]);
  }
  const cityTokens = (n) =>
    norm(n).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
      .filter((t) => t.length > 3 && !['ironman', 'european', 'championship', 'france', 'switzerland', 'austria'].includes(t) && !/^\d+$/.test(t));
  for (const race of races) {
    const toks = cityTokens(race.name);
    const want703 = race.series === 'ironman703';
    // Whole-token match on the slug's hyphen parts (so "nice" doesn't match "venice").
    const matches = [...urls].filter((u) => {
      const slug = (u.split('/races/')[1] || '').toLowerCase().split('-');
      return toks.some((c) => slug.includes(c));
    });
    // prefer the right distance (70.3 slugs carry "703")
    matches.sort((a, b) => (/(^|[^0-9])703/.test(b) === want703 ? 1 : 0) - (/(^|[^0-9])703/.test(a) === want703 ? 1 : 0));
    race.url = matches[0];
  }
  return races.filter((r) => r.url);
}

// --- Pull pro names out of whatever JSON the page fetched ----------------------
function fullName(o) {
  if (typeof o !== 'object' || !o) return '';
  const first = o.firstName || o.first_name || o.firstname || o.givenName || o.given_name;
  const last = o.lastName || o.last_name || o.lastname || o.familyName || o.family_name || o.surname;
  return String(o.fullName || o.full_name || o.athleteName || o.displayName || o.name || (first && last ? `${first} ${last}` : '') || '').trim();
}
function countryOf(o) {
  const c = o.countryCode || o.country_code || o.country || o.nationality || o.nat || o.iso || '';
  return typeof c === 'string' && /^[A-Za-z]{2,3}$/.test(c) ? c.toUpperCase() : '';
}
// Walk a payload, return every array of objects (deep) so we can score each.
function objectArrays(node, out = []) {
  if (Array.isArray(node)) {
    if (node.some((x) => x && typeof x === 'object')) out.push(node);
    node.forEach((x) => objectArrays(x, out));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach((v) => objectArrays(v, out));
  }
  return out;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('playwright not installed → IRONMAN layer skipped.');
    return;
  }
  const now = Date.now() - MONTH_MS;
  const todayISO = new Date(now).toISOString().slice(0, 10);
  const roster = await knownRoster();
  const seenObj = JSON.parse(await readFile(SEEN, 'utf8').catch(() => '{"seen":[]}'));
  const seen = new Set(seenObj.seen || []);

  const races = (await targetRaces(now)).filter((r) => !seen.has(r.url)).slice(0, MAX_RACES);
  console.log(`IRONMAN races to render: ${races.length}`);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ userAgent: UA });
  const starts = {};
  const minted = new Map();

  for (const race of races) {
    const page = await ctx.newPage();
    const payloads = [];
    page.on('response', async (res) => {
      const ctype = res.headers()['content-type'] || '';
      if (!/json/i.test(ctype)) return;
      try { payloads.push({ url: res.url(), json: await res.json() }); } catch { /* */ }
    });
    try {
      await page.goto(race.url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);
    } catch { /* */ }
    await page.close();
    seen.add(race.url);

    // Score every captured array by how many of its entries are verified pros.
    let best = { count: 0, names: [], from: '' };
    for (const { url, json } of payloads) {
      for (const arr of objectArrays(json)) {
        const found = [];
        for (const o of arr) {
          const nm = fullName(o);
          if (!nm) continue;
          const hit = roster.get(nameKey(nm));
          if (hit) found.push({ ...hit, name: nm, country: countryOf(o) || hit.country });
        }
        if (found.length > best.count) best = { count: found.length, names: found, from: url };
      }
    }
    console.log(`· ${race.name}: ${payloads.length} JSON responses, best start list = ${best.count} pros${best.from ? ` (${best.from.slice(0, 70)})` : ''}`);
    if (best.count < 3) continue; // not a credible start list

    for (const a of best.names) {
      if (!minted.has(a.id)) minted.set(a.id, { id: a.id, name: a.name, country: a.country || '', series: [race.series] });
      const list = (starts[a.id] ??= []);
      if (!list.some((s) => s.date === race.date)) {
        list.push({ date: race.date, event: race.name, series: race.series, url: race.url, confidence: 'confirmed' });
      }
    }
  }
  await browser.close();

  // Accumulate onto the committed file; dedup per athlete by date; prune past races.
  const prevRaw = await readFile(OUT, 'utf8').catch(() => '');
  let prev = {};
  try { prev = JSON.parse(prevRaw); } catch { /* */ }
  const athletesById = new Map();
  for (const a of prev.athletes ?? []) athletesById.set(a.id, a);
  for (const a of minted.values()) {
    const ex = athletesById.get(a.id);
    if (!ex) athletesById.set(a.id, a);
    else ex.series = [...new Set([...(ex.series ?? []), ...(a.series ?? [])])];
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
    note: 'Pro athletes + CONFIRMED starts read from ironman.com race pages via a headless browser (Playwright captures the page’s own athlete XHR JSON). Every athlete is verified against the pro roster (WTCS/PTO/media/curated + the official PTO World Ranking) — no age groupers. Accumulated across runs, pruned to future races. Merged under curated/WTCS/PTO/media. Regenerated by the pipeline; do not hand-edit.',
    athletes: keptAthletes.sort((a, b) => a.name.localeCompare(b.name)),
    starts: mergedStarts,
  };
  const stripDate = (raw) => { try { const o = JSON.parse(raw); delete o.generatedAt; return JSON.stringify(o); } catch { return raw; } };
  if (stripDate(JSON.stringify(out)) !== stripDate(prevRaw)) await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  await writeFile(SEEN, JSON.stringify({ note: 'IRONMAN race URLs already rendered (so we do not re-render every run).', seen: [...seen] }, null, 2) + '\n');
  const total = Object.values(mergedStarts).reduce((n, l) => n + l.length, 0);
  console.log(`\nTotal ${total} starts / ${keptAthletes.length} athletes → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
