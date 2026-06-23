/**
 * Pro start lists ingest — Stage 3 (media start-list articles).
 *
 * Triathlon media (triathlon.de, tri-mag.de, …) publish "Profi-Startliste <race>"
 * articles — server-rendered and often EARLIER than the official PTO/IRONMAN list.
 * Their pro field is a table: BIB (M1/W1 …) · Name · Nation (ISO-3). We PARSE that
 * table directly (no LLM) → create every listed pro as an athlete (id slug, name,
 * country from ISO-3→ISO-2, gender from the M/W bib, series from the race circuit)
 * + a CONFIRMED upcoming start linking to the article.
 *
 * Important: <script>/<style> (incl. JSON-LD competitor blocks for OTHER events)
 * are stripped first, and only the M#/W# table rows are read — so we get the whole
 * field and nothing from teasers/related content.
 *
 * Registry: src/data/proStartArticles.json. Pure Node built-ins.
 * Writes src/data/proStartsMedia.json. Usage: node scripts/ingest-pro-starts-media.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = resolve(ROOT, 'src/data/proStartArticles.json');
const OUT = resolve(ROOT, 'src/data/proStartsMedia.json');
const UA = 'Mozilla/5.0 (TriZone-ProRadar; +https://trizone.app)';

// ISO 3166-1 alpha-3 → alpha-2 (the codes triathlon.de uses). Endurance nations.
const A3 = {
  DEU: 'DE', GBR: 'GB', FRA: 'FR', ITA: 'IT', ESP: 'ES', NOR: 'NO', SWE: 'SE',
  DNK: 'DK', FIN: 'FI', NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT', PRT: 'PT',
  POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', IRL: 'IE', LUX: 'LU', EST: 'EE',
  LTU: 'LT', LVA: 'LV', UKR: 'UA', ROU: 'RO', BGR: 'BG', GRC: 'GR', HRV: 'HR',
  SVN: 'SI', SRB: 'RS', USA: 'US', CAN: 'CA', MEX: 'MX', BRA: 'BR', ARG: 'AR',
  CHL: 'CL', AUS: 'AU', NZL: 'NZ', ZAF: 'ZA', JPN: 'JP', CHN: 'CN', KOR: 'KR',
  HKG: 'HK', SGP: 'SG', ISR: 'IL', TUR: 'TR', ISL: 'IS', RSA: 'ZA',
};

const slug = (s) =>
  s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Parse the BIB·Name·Nation rows of a start-list table. */
function parseStartList(text) {
  const rows = [];
  const re = /\b([MW])\d+\s+([A-Za-zÀ-ÿ.'’\- ]{3,40}?)\s+([A-Z]{3})\b/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[2].replace(/\s+/g, ' ').trim();
    if (!/[a-zà-ÿ]/.test(name) || !name.includes(' ')) continue; // need a real "First Last"
    rows.push({ gender: m[1] === 'W' ? 'women' : 'men', name, noc: m[3] });
  }
  return rows;
}

// --- Auto-discovery: find triathlon.de pro start-list articles via the sitemap --
const MONTHS_DE = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};
/** First clearly future race date in the article text ("28. Juni 2026" / "28.06.2026"). */
function extractRaceDate(text, now) {
  let m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(20\d{2})/);
  if (m && MONTHS_DE[m[2].toLowerCase()]) {
    const iso = `${m[3]}-${String(MONTHS_DE[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    if (+new Date(iso) >= now) return iso;
  }
  for (const mm of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g)) {
    const iso = `${mm[3]}-${String(+mm[2]).padStart(2, '0')}-${String(+mm[1]).padStart(2, '0')}`;
    if (+new Date(iso) >= now) return iso;
  }
  return null;
}
function seriesFromSlug(s) {
  if (/70-?3/.test(s)) return 'ironman703';
  if (/t100/.test(s)) return 't100';
  if (/ironman|im-/.test(s)) return 'ironman';
  return undefined; // Challenge etc. → no series enum
}
function eventFromSlug(s) {
  const words = s
    .replace(/profi|startliste|favoriten|streckenplan|maenner|m[äa]nner|frauen|\b20\d{2}\b/g, ' ')
    .replace(/-/g, ' ').replace(/70 3/g, '70.3').replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean);
  return words
    .map((w) => (/^(wm|em)$/i.test(w) ? w.toUpperCase() : /ironman/i.test(w) ? 'IRONMAN' : w === '70.3' ? '70.3' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
async function discover() {
  const xml = (await fetchText('https://triathlon.de/sitemap_blogs_1.xml')) || '';
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((u) => /startliste/i.test(u) && /profi/i.test(u) && /20(2[6-9]|[3-9]\d)/.test(u));
}

async function main() {
  const now = Date.now() - 864e5;
  const { articles } = JSON.parse(await readFile(REG, 'utf8'));
  // Auto-discovered triathlon.de articles (event/series from slug, date from the
  // article) — added unless already pinned in the registry (registry meta wins).
  const pinned = new Set(articles.map((a) => a.url.split('?')[0]));
  for (const url of await discover()) {
    if (pinned.has(url.split('?')[0])) continue;
    const slug = url.split('/').pop().replace(/\?.*$/, '');
    articles.push({ url, slug, _derive: true, event: eventFromSlug(slug), series: seriesFromSlug(slug), confidence: 'confirmed' });
  }
  const athletes = new Map();
  const starts = {};

  for (const art of articles) {
    const html = await fetchText(art.url);
    if (!html) {
      console.log(`· ${art.event}: fetch failed`);
      continue;
    }
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (art._derive) {
      art.date = extractRaceDate(text, now);
      if (!art.date) {
        console.log(`· ${art.event}: no clear future race date → skip`);
        continue;
      }
    }
    const rows = parseStartList(text);
    if (!rows.length) {
      console.log(`· ${art.event}: no start-list table found`);
      continue;
    }
    const seen = new Set();
    for (const r of rows) {
      const id = slug(r.name);
      if (seen.has(id)) continue; // one entry per athlete per race
      seen.add(id);
      if (!athletes.has(id)) {
        athletes.set(id, {
          id,
          name: r.name,
          country: A3[r.noc] || '',
          gender: r.gender,
          series: art.series ? [art.series] : [],
        });
      } else if (art.series && !athletes.get(id).series.includes(art.series)) {
        athletes.get(id).series.push(art.series);
      }
      (starts[id] ??= []).push({
        date: art.date,
        event: art.event,
        ...(art.series ? { series: art.series } : {}),
        ...(art.location ? { location: art.location } : {}),
        url: art.url,
        confidence: art.confidence || 'confirmed',
      });
    }
    console.log(`· ${art.event} (${art.date}): ${seen.size} pros parsed from the start list`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    note: 'Pro athletes + CONFIRMED upcoming starts parsed from media start-list tables (registry: proStartArticles.json). BIB/Name/Nation rows only (scripts incl. JSON-LD stripped). No LLM. Merged on top of curated + WTCS + PTO. Regenerated by the pipeline.',
    athletes: [...athletes.values()].sort((a, b) => a.name.localeCompare(b.name)),
    starts,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${out.athletes.length} pro athletes (+ confirmed starts) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
