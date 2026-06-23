/**
 * Code-Radar ingest — Stage 1 (podcasts).
 *
 * Reads the source watchlist (src/data/codeSources.json), pulls the newest
 * episodes of each podcast, and extracts DISCOUNT-CODE CANDIDATES from the
 * shownotes (RSS <description>/<content:encoded>). Writes them to a REVIEW INBOX
 * (src/data/codeInbox.json) — it NEVER touches the live codes. A human approves
 * candidates into src/lib/discountCodes.ts (a dead code at checkout burns trust).
 *
 * Design goals:
 *  - Zero dependencies (Node built-ins only) so CI needs no `npm install`.
 *  - Add a source = add one line in codeSources.json. Podcast RSS is auto-resolved
 *    via the iTunes lookup (no API key), so you only need the show's name.
 *  - Recall over precision: catch loosely, let the human filter in the inbox.
 *
 * Usage:
 *   node scripts/ingest-codes.mjs            # newest 4 episodes / feed, last 365 days
 *   node scripts/ingest-codes.mjs --max=8 --days=120
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = resolve(ROOT, 'src/data/codeSources.json');
const OUT = resolve(ROOT, 'src/data/codeInbox.json');
const BRANDS_TS = resolve(ROOT, 'src/lib/brands.ts');
const CODES_TS = resolve(ROOT, 'src/lib/discountCodes.ts');
const UA = 'TriZone-CodeRadar/1.0 (+https://trizone.app)';

const argNum = (name, def) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? Number(m.split('=')[1]) : def;
};
const MAX_ITEMS = argNum('max', 4); // only the freshest episodes → freshest codes
const MAX_DAYS = argNum('days', 365); // outer bound; the 4-newest cap keeps it fresh

// --- HTTP --------------------------------------------------------------------
async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000); // some podcast feeds are several MB
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// --- Text helpers ------------------------------------------------------------
const stripCdata = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ');
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const clean = (s) => decode(stripTags(stripCdata(s || ''))).replace(/\s+/g, ' ').trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

// --- Brand matching (parsed from brands.ts, no import needed) -----------------
async function loadBrands() {
  const src = await readFile(BRANDS_TS, 'utf8').catch(() => '');
  const out = [];
  for (const m of src.matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/g)) {
    out.push({ id: m[1], name: m[2] });
  }
  return out;
}
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function matchBrand(text, brands) {
  const t = norm(text);
  // longest name first so "Precision Fuel" wins over a short substring
  for (const b of [...brands].sort((a, z) => z.name.length - a.name.length)) {
    if (t.includes(norm(b.name))) return b;
  }
  return null;
}

// --- Existing live codes (so the inbox only shows NEW ones) -------------------
async function loadLiveCodes() {
  const src = await readFile(CODES_TS, 'utf8').catch(() => '');
  return new Set([...src.matchAll(/code:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase()));
}

// --- Candidate extraction ----------------------------------------------------
// A code token: starts alnum, 3-24 chars of letters/digits/._- ; must look
// code-like (contains a digit OR is mostly uppercase) and not be a stopword.
const STOP = new Set([
  'der', 'die', 'das', 'und', 'bei', 'auf', 'den', 'dem', 'ist', 'für', 'fuer', 'mit', 'zum', 'zur',
  'ein', 'eine', 'hier', 'code', 'codes', 'gibt', 'gibts', 'euch', 'ihr', 'wir', 'the', 'and', 'for',
  'with', 'use', 'your', 'shop', 'link', 'mehr', 'unter', 'sowie', 'oder', 'auch', 'beim', 'einen',
]);
const TRIGGER =
  /(?:rabatt(?:code)?|gutschein(?:code)?|promo(?:code)?|discount\s*code|\bcode|codewort)\s*[:\-–]?\s*["“„'`]?([A-Za-z][A-Za-z0-9._-]{2,23})/gi;

function codeLike(tok) {
  if (STOP.has(tok.toLowerCase())) return false;
  const hasDigit = /\d/.test(tok);
  const upperish = tok === tok.toUpperCase();
  const camelBrandish = /^[A-Z][a-z]+\d/.test(tok); // e.g. Schmidti10, Jan20
  return hasDigit || upperish || camelBrandish;
}

// --- Expiry detection --------------------------------------------------------
// Finds an expiry date near the code so the app can hide it once it lapses.
// Handles "gültig bis 31.12.2026", "bis zum 31. Dezember", "valid until 12/31",
// numeric (DD.MM(.YYYY)) and named-month German/English dates. Year is inferred
// (this year, or next if the day already passed) when omitted.
const MONTHS = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
  jan: 1, feb: 2, mär: 3, maer: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9,
  sept: 9, okt: 10, nov: 11, dez: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, october: 10, december: 12,
};
const EXPIRY_CTX = /(g[üu]ltig|gilt|l[äa]uft|valid|expir|endet|ends|einl[öo]sbar|nur noch|bis)/i;

function findExpiry(win, now) {
  const hits = [];
  for (const m of win.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g)) {
    hits.push({ idx: m.index, d: +m[1], mo: +m[2], y: m[3] });
  }
  for (const m of win.matchAll(/(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ]+)\.?\s*(\d{4})?/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) hits.push({ idx: m.index, d: +m[1], mo, y: m[3] });
  }
  for (const h of hits.sort((a, b) => a.idx - b.idx)) {
    if (h.mo < 1 || h.mo > 12 || h.d < 1 || h.d > 31) continue;
    const before = win.slice(Math.max(0, h.idx - 34), h.idx);
    if (!EXPIRY_CTX.test(before)) continue; // only dates introduced by an expiry phrase
    let year = h.y ? (h.y.length === 2 ? 2000 + +h.y : +h.y) : new Date(now).getUTCFullYear();
    if (!h.y && +new Date(Date.UTC(year, h.mo - 1, h.d)) < now - 2 * 864e5) year += 1;
    return `${year}-${String(h.mo).padStart(2, '0')}-${String(h.d).padStart(2, '0')}`;
  }
  return null;
}

function extract(text, ctx, now) {
  const found = new Map(); // code(lower) -> candidate
  let m;
  TRIGGER.lastIndex = 0;
  while ((m = TRIGGER.exec(text))) {
    const code = m[1].replace(/[._-]+$/, '');
    if (!codeLike(code)) continue;
    const at = m.index;
    const snippet = text.slice(Math.max(0, at - 70), Math.min(text.length, at + code.length + 70)).trim();
    const pctNear = snippet.match(/(\d{1,2})\s*(?:%|prozent)/i);
    // Wider window for an expiry date that belongs to this code.
    const win = text.slice(Math.max(0, at - 40), Math.min(text.length, at + code.length + 220));
    const key = code.toLowerCase();
    if (!found.has(key)) {
      found.set(key, {
        code,
        percent: pctNear ? Number(pctNear[1]) : undefined,
        validUntil: findExpiry(win, now) || undefined,
        snippet,
        ...ctx,
      });
    }
  }
  return [...found.values()];
}

// --- Source resolution -------------------------------------------------------
async function resolveFeed(src) {
  if (src.rss) return src.rss;
  const country = src.country || 'DE';
  const tryStore = async (c) => {
    const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=1&country=${c}&term=${encodeURIComponent(src.name)}`;
    const raw = await fetchText(url, { headers: { Accept: 'application/json' } });
    if (!raw) return null;
    try {
      const j = JSON.parse(raw);
      return j.results?.[0]?.feedUrl || null;
    } catch {
      return null;
    }
  };
  return (await tryStore(country)) || (country !== 'US' ? await tryStore('US') : null);
}

// --- RSS parse ---------------------------------------------------------------
function parseItems(xml, max, cutoff) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const out = [];
  for (const it of items) {
    const date = new Date(clean(tag(it, 'pubDate')) || 0);
    if (cutoff && +date && +date < cutoff) continue;
    const body = clean(tag(it, 'content:encoded') || tag(it, 'description') || tag(it, 'itunes:summary'));
    out.push({
      title: clean(tag(it, 'title')),
      body,
      date: +date ? date.toISOString().slice(0, 10) : '',
      link: clean(tag(it, 'link')) || clean(tag(it, 'guid')),
    });
    if (out.length >= max) break;
  }
  return out;
}

// --- YouTube (no API key) ----------------------------------------------------
// Every channel exposes an Atom feed at feeds/videos.xml?channel_id=UC… that
// includes the full video description (<media:description>) — same idea as a
// podcast feed, that's where channels put their sponsor codes.
const BROWSER_UA = 'Mozilla/5.0 (TriZone-CodeRadar)';
const channelCache = new Map();
async function resolveChannelId(url) {
  if (!url) return null;
  let m = url.match(/channel\/(UC[\w-]+)/);
  if (m) return m[1];
  if (/^UC[\w-]+$/.test(url)) return url; // raw id given
  if (channelCache.has(url)) return channelCache.get(url);
  const html = await fetchText(url, { headers: { 'User-Agent': BROWSER_UA } });
  m = html && (html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]+)/));
  const cid = m ? m[1] : null;
  channelCache.set(url, cid);
  return cid;
}

function parseYouTube(xml, max, cutoff) {
  const entries = [...xml.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map((m) => m[0]);
  const out = [];
  for (const e of entries) {
    const date = new Date(clean(tag(e, 'published')) || 0);
    if (cutoff && +date && +date < cutoff) continue;
    const vid = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    out.push({
      title: clean(tag(e, 'title')),
      body: clean(tag(e, 'media:description')),
      date: +date ? date.toISOString().slice(0, 10) : '',
      link: vid ? `https://youtu.be/${vid}` : '',
    });
    if (out.length >= max) break;
  }
  return out;
}

const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// --- Main --------------------------------------------------------------------
async function main() {
  const { sources } = JSON.parse(await readFile(SOURCES, 'utf8'));
  const brands = await loadBrands();
  const live = await loadLiveCodes();
  const now = Date.now();
  const todayISO = new Date(now).toISOString().slice(0, 10);
  const cutoff = now - MAX_DAYS * 24 * 60 * 60 * 1000;

  const candidates = new Map(); // dedupe key -> candidate
  for (const src of sources) {
    let items;
    if (src.type === 'podcast') {
      const feed = await resolveFeed(src);
      if (!feed) {
        console.log(`· ${src.name}: no RSS feed resolved`);
        continue;
      }
      const xml = await fetchText(feed);
      if (!xml) {
        console.log(`· ${src.name}: feed fetch failed`);
        continue;
      }
      items = parseItems(xml, MAX_ITEMS, cutoff);
    } else if (src.type === 'youtube') {
      const cid = await resolveChannelId(src.youtube || src.url);
      if (!cid) {
        console.log(`· ${src.name}: no YouTube channel resolved`);
        continue;
      }
      const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, {
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (!xml) {
        console.log(`· ${src.name}: YouTube feed fetch failed`);
        continue;
      }
      items = parseYouTube(xml, MAX_ITEMS, cutoff);
    } else {
      console.log(`· skip ${src.name} (type "${src.type}" not handled)`);
      continue;
    }

    let n = 0;
    for (const it of items) {
      for (const c of extract(it.body, { source: src.name, sourceType: src.type, episode: it.title, date: it.date, url: it.link }, now)) {
        if (live.has(c.code.toLowerCase())) continue; // already a live code
        if (c.validUntil && c.validUntil < todayISO) continue; // already expired → drop
        const brand = matchBrand(`${c.snippet} ${it.body.slice(0, 400)}`, brands);
        const key = `${slug(src.name)}|${c.code.toLowerCase()}`;
        if (candidates.has(key)) continue;
        candidates.set(key, {
          id: `cand-${slug(src.name)}-${c.code.toLowerCase()}`,
          code: c.code,
          brand: brand?.name,
          brandId: brand?.id,
          percent: c.percent,
          validUntil: c.validUntil,
          athleteId: src.athleteId,
          source: c.source,
          sourceType: c.sourceType,
          episode: c.episode,
          date: c.date,
          url: c.url,
          snippet: c.snippet,
          status: 'pending',
        });
        n++;
      }
    }
    const unit = src.type === 'youtube' ? 'videos' : 'episodes';
    console.log(`· ${src.name}: ${items.length} ${unit} → ${n} candidate(s)`);
  }

  const list = [...candidates.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const out = { generatedAt: new Date().toISOString(), note: 'Code candidates found by the Code-Radar robot. Review and move good ones into src/lib/discountCodes.ts. NOT shown in the app.', candidates: list };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  console.log(`\nWrote ${list.length} candidate(s) → ${OUT}`);
  if (list.length) {
    console.log('\nTop candidates:');
    for (const c of list.slice(0, 25)) {
      console.log(`  [${c.brand || '??'}] ${c.code}${c.percent ? ` (${c.percent}%)` : ''}${c.validUntil ? ` [bis ${c.validUntil}]` : ''} — ${c.sourceType === 'youtube' ? '▶ ' : ''}${c.source}${c.athleteId ? ` · ${c.athleteId}` : ''}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
