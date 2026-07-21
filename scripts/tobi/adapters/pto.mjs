/**
 * Tobi · adapter: PTO (stats.protriathletes.org).
 *
 * The results page is server-rendered (plain-Node readable, no headless browser, no LLM). Men live in the
 * `#MPRO` tab-panel, women in `#FPRO`; each is a `<table class="race-results">` whose finisher rows are
 *   <tr><td>{position}</td> … <a href="/athlete/{slug}" class="athlete-pic-group"> …
 * DNS/DNF rows sort to the bottom (overall `--:--`), so ordering by the position cell and taking the top N
 * is robust even on a page pulled mid-race.
 *
 * parsePto() is a PURE function of the HTML string → offline-testable against a saved fixture.
 */
import { readFile } from 'node:fs/promises';

const BASE = 'https://stats.protriathletes.org';
const UA = 'Mozilla/5.0 (TriZone-Tobi; +https://trizone.app)';

function panelTable(html, panelId) {
  const start = html.indexOf(`id="${panelId}"`);
  if (start < 0) return '';
  const tblStart = html.indexOf('<table', start);
  if (tblStart < 0) return '';
  const tblEnd = html.indexOf('</table>', tblStart);
  return tblEnd < 0 ? html.slice(tblStart) : html.slice(tblStart, tblEnd);
}

function topFinishers(tableHtml, topN) {
  const found = [];
  for (const row of tableHtml.split('<tr').slice(1)) {
    const pos = row.match(/^[^>]*>\s*<td[^>]*>\s*(\d+)\s*<\/td>/); // leading position cell (skips `<tr head>`)
    const slug = row.match(/\/athlete\/([a-z0-9-]+)"\s+class="athlete-pic-group/);
    if (pos && slug) found.push({ pos: Number(pos[1]), slug: slug[1] });
  }
  found.sort((a, b) => a.pos - b.pos);
  return found.slice(0, topN).map((x) => x.slug);
}

/** Pure parse: results-page HTML → `{ men, women }` top-N slugs (winner first). */
export function parsePto(html, topN = 5) {
  return {
    men: topFinishers(panelTable(html, 'MPRO'), topN),
    women: topFinishers(panelTable(html, 'FPRO'), topN),
  };
}

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

/**
 * Adapter entry: PTO race ref `{ slug, year }` → a source result the core can evaluate.
 * @param {{slug:string, year:number}} ref
 * @param {{ topN?:number, fixture?:string }} [opts]  fixture = local HTML path (offline, no network).
 * @returns {Promise<{ source:'pto', ok:boolean, url:string, men:string[], women:string[] }>}
 */
export async function ptoAdapter(ref, opts = {}) {
  const { topN = 5, fixture } = opts;
  const url = `${BASE}/race/${ref.slug}/${ref.year}/results`;
  const html = fixture
    ? await readFile(fixture, 'utf8').catch(() => null)
    : await fetchText(url);
  if (!html) return { source: 'pto', ok: false, url, men: [], women: [] };
  const { men, women } = parsePto(html, topN);
  return { source: 'pto', ok: true, url, men, women };
}
