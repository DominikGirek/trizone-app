/**
 * mikatiming pro start lists — plain-Node ingest (no browser).
 *
 * Some races (Challenge Roth …) publish their COMPLETE official pro field through a
 * mikatiming start-list iframe that IS server-rendered once you hit the list endpoint
 * with the right query:
 *   {base}?pid=startlist_iframe_list&event={proCode}&search[sex]={M|W}&num_results=500&…
 * Each row is `<h4 class="… type-fullname"><a …>Lastname, Firstname (NOC)</a>`. This is
 * the authoritative entry list (more complete than a media "strongest field" preview —
 * e.g. it includes Pohle/Wolos), and the sex filter gives gender directly.
 *
 * Config-driven: add a race = one MIKA_RACES entry. Date/name come from our series
 * events (matched by city). Accumulates onto the committed file, prunes past races.
 *
 * Usage: node scripts/ingest-pro-starts-mika.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/proStartsMika.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// One entry per mika-timed race. `event` = the "Professional Athletes" event code in the
// iframe's event <select>; `city` matches our series event for the date + display name.
const MIKA_RACES = [
  { base: 'https://roth-iframe.r.mikatiming.com/2026/', event: 'P', city: 'roth', series: 'challenge' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// IOC/NOC alpha-3 → ISO 3166 alpha-2 (endurance nations; unknown → '').
const A3 = {
  GER: 'DE', AUT: 'AT', SUI: 'CH', FRA: 'FR', GBR: 'GB', NED: 'NL', BEL: 'BE', ESP: 'ES', ITA: 'IT',
  POR: 'PT', POL: 'PL', CZE: 'CZ', SVK: 'SK', DEN: 'DK', NOR: 'NO', SWE: 'SE', FIN: 'FI', IRL: 'IE',
  USA: 'US', CAN: 'CA', MEX: 'MX', BRA: 'BR', ARG: 'AR', CHI: 'CL', URU: 'UY', AUS: 'AU', NZL: 'NZ',
  RSA: 'ZA', JPN: 'JP', CHN: 'CN', KOR: 'KR', HKG: 'HK', UKR: 'UA', HUN: 'HU', SLO: 'SI', CRO: 'HR',
  EST: 'EE', LAT: 'LV', LTU: 'LT', LUX: 'LU', ISL: 'IS', ISR: 'IL', TUR: 'TR', GRE: 'GR', ROU: 'RO',
};

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.challenge-roth.com/' }, signal: ctrl.signal });
    return r.ok ? await r.text() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

async function seriesRaces() {
  const src = await readFile(resolve(ROOT, 'src/mocks/seriesEvents.ts'), 'utf8').catch(() => '');
  const out = [];
  for (const m of src.matchAll(/name:\s*'([^']+)'[\s\S]*?town:\s*'([^']+)'[\s\S]*?date:\s*'([^']+)'/g)) {
    out.push({ name: m[1], town: m[2], date: m[3].slice(0, 10) });
  }
  return out;
}

// "Lastname, Firstname (NOC)" → { name:"Firstname Lastname", country }
function parseRow(raw) {
  const m = raw.match(/^(.+?),\s*(.+?)\s*\(([A-Za-z]{3})\)\s*$/);
  if (!m) return null;
  const name = `${m[2].trim()} ${m[1].trim()}`.replace(/\s+/g, ' ');
  return { name, country: A3[m[3].toUpperCase()] || '' };
}

async function listFor(base, event, sex) {
  const url = `${base}?pid=startlist_iframe_list&event=${event}&search%5Bsex%5D=${sex}&num_results=500&lang=EN_CAP&startpage=startlist&startpage_type=search`;
  const html = await get(url);
  const out = [];
  for (const m of html.matchAll(/type-fullname"><a[^>]*>([^<]+)<\/a>/g)) {
    const row = parseRow(m[1].trim());
    if (row && row.name.includes(' ')) out.push(row);
  }
  return out;
}

async function main() {
  const now = Date.now() - 864e5;
  const todayISO = new Date(now).toISOString().slice(0, 10);
  const series = await seriesRaces();

  const starts = {};
  const minted = new Map();

  for (const race of MIKA_RACES) {
    const match = series.find((r) => norm(r.name + ' ' + r.town).includes(race.city));
    if (!match) { console.log(`· ${race.city}: no matching series event → skip`); continue; }
    let n = 0;
    for (const sex of ['M', 'W']) {
      const gender = sex === 'M' ? 'men' : 'women';
      for (const a of await listFor(race.base, race.event, sex)) {
        const id = slugify(a.name);
        if (!id) continue;
        if (!minted.has(id)) minted.set(id, { id, name: a.name, country: a.country, gender, series: [race.series] });
        const list = (starts[id] ??= []);
        if (!list.some((s) => s.date === match.date)) {
          list.push({ date: match.date, event: match.name, series: race.series, location: match.town, url: `${race.base}?pid=startlist_iframe`, confidence: 'confirmed' });
          n++;
        }
      }
      await sleep(1500);
    }
    console.log(`· ${race.city} → ${match.name} (${match.date}): ${n} pros`);
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
    else { ex.series = [...new Set([...(ex.series ?? []), ...(a.series ?? [])])]; if (!ex.gender && a.gender) ex.gender = a.gender; if (!ex.country && a.country) ex.country = a.country; }
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
    note: 'Pro athletes + CONFIRMED starts read from official mikatiming Pro Series start lists (server-rendered list endpoint, gender from the sex filter). The complete official entry field. Accumulated across runs, pruned to future races. Merged under curated/WTCS/PTO/media. Regenerated by the pipeline; do not hand-edit.',
    athletes: keptAthletes.sort((a, b) => a.name.localeCompare(b.name)),
    starts: mergedStarts,
  };
  const stripDate = (raw) => { try { const o = JSON.parse(raw); delete o.generatedAt; return JSON.stringify(o); } catch { return raw; } };
  if (stripDate(JSON.stringify(out)) !== stripDate(prevRaw)) await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  const total = Object.values(mergedStarts).reduce((s, l) => s + l.length, 0);
  console.log(`\nTotal ${total} starts / ${keptAthletes.length} athletes → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
