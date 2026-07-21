/**
 * Tobi · adapter: mikatiming (official timer for Challenge Roth & other MIKA-timed races).
 *
 * The results list is server-rendered via the same iframe endpoint the start-list robot already uses, but
 * with `pid=list` (finished results) instead of `pid=startlist_iframe_list`. One request PER gender
 * (`search[sex]=M|W`). Each finisher row carries an overall place cell
 *   <… type-place … place-primary numeric …>{position}<…
 * and a name link `type-fullname"><a …>Lastname, Firstname (NOC)`. Names → slugs the same way the MIKA
 * start-list ingest does (NFD-strip diacritics), so they line up with our roster.
 *
 * Independent of PTO (different organisation, the actual chip timer) → a real cross-source check.
 * parseMika() is pure → offline-testable against a saved fixture.
 */
import { readFile } from 'node:fs/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// "Lastname, Firstname (NOC)" → "firstname-lastname" (matches scripts/ingest-pro-starts-mika.mjs slugify).
function slugifyName(fullname) {
  const m = fullname.match(/^(.+?),\s*(.+?)\s*\(([A-Za-z]{3})\)\s*$/);
  if (!m) return null;
  return `${m[2].trim()} ${m[1].trim()}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Pure parse: one gender's MIKA results-list HTML → top-N slugs (winner first). */
export function parseMika(html, topN = 5) {
  const rows = [];
  const re = /place-primary numeric"[^>]*>\s*(\d+)\s*<[\s\S]{0,500}?type-fullname"><a[^>]*>([^<]+)</g;
  for (const m of html.matchAll(re)) {
    const slug = slugifyName(m[2].trim());
    if (slug) rows.push({ pos: Number(m[1]), slug });
  }
  rows.sort((a, b) => a.pos - b.pos);
  return rows.slice(0, topN).map((r) => r.slug);
}

async function fetchGender(base, event, sex) {
  const url = `${base}?pid=list&event=${event}&search%5Bsex%5D=${sex}&num_results=10&lang=EN_CAP&page=1`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.challenge-roth.com/' }, signal: ctrl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Adapter entry: MIKA race ref `{ base, event }` → a source result the core can evaluate.
 * @param {{base:string, event:string}} ref
 * @param {{ topN?:number, fixture?:{men?:string, women?:string} }} [opts]  fixture = local HTML paths (offline).
 * @returns {Promise<{ source:'mika', ok:boolean, url:string, men:string[], women:string[] }>}
 */
export async function mikaAdapter(ref, opts = {}) {
  const { topN = 5, fixture } = opts;
  const url = `${ref.base}?pid=list&event=${ref.event}`;
  const [menHtml, womenHtml] = fixture
    ? await Promise.all([
        fixture.men ? readFile(fixture.men, 'utf8').catch(() => null) : null,
        fixture.women ? readFile(fixture.women, 'utf8').catch(() => null) : null,
      ])
    : await Promise.all([fetchGender(ref.base, ref.event, 'M'), fetchGender(ref.base, ref.event, 'W')]);
  if (!menHtml && !womenHtml) return { source: 'mika', ok: false, url, men: [], women: [] };
  return {
    source: 'mika',
    ok: true,
    url,
    men: menHtml ? parseMika(menHtml, topN) : [],
    women: womenHtml ? parseMika(womenHtml, topN) : [],
  };
}
