/**
 * Pro start lists ingest — Stage 4 (multi-magazine, multi-language, via LLM).
 *
 * The scalable layer. Two discovery modes feed one extractor:
 *   A) PER-RACE SEARCH (autonomous): for each upcoming race in the PTO pro-race
 *      calendar (real name + date), search the open web (DuckDuckGo HTML, direct
 *      URLs, any language) for its start-list / pro-field article → so the field
 *      is found even when it's prose, an odd slug, or on a site we don't follow
 *      (e.g. Challenge Roth's field on triathlon.de/tri-mag/challenge-roth.com).
 *   B) FEED SCAN: magazine RSS/Atom feeds (proStartFeeds.json) for start-list
 *      titles.
 * A small LLM (Claude Haiku) extracts the field from ANY format/language.
 *
 * Reliability + cost guards so it can't drift or explode:
 *   - NO KEY → no-op (optional layer).
 *   - Only NEW articles (seen-cache) that pass a free pre-filter reach the model;
 *     hard MAX_LLM_CALLS ceiling/run; trimmed input; Haiku (cheapest).
 *   - Race + DATE come from the catalog (per-race mode) → never invented.
 *   - Extracted athletes kept ONLY if already in our roster → no hallucinated/new
 *     athletes (this layer CONFIRMS known pros' starts early; structured robots
 *     grow the roster). Set a hard spend cap in the Anthropic console as backstop.
 *
 * Writes src/data/proStartsLLM.json (starts only) + updates llmSeenArticles.json.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEEDS = resolve(ROOT, 'src/data/proStartFeeds.json');
const SEEN = resolve(ROOT, 'src/data/llmSeenArticles.json');
const OUT = resolve(ROOT, 'src/data/proStartsLLM.json');
// Realistic browser UA — several magazines (Cloudflare/WordPress) 403 bot UAs.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.TRIZONE_LLM_MODEL || 'claude-haiku-4-5-20251001';
const MAX_LLM_CALLS = Number(process.env.TRIZONE_LLM_MAX_CALLS || 24); // hard cost ceiling / run (~$0.25 of Haiku)
const RACE_WINDOW_DAYS = 75; // only search races this close (fields are published near the race)
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TITLE_RE = /startliste|start[\s-]?list|startlist|starterfeld|profi.?(feld|liste|start)|elite (field|start|wave)|pro (field|start ?list)|lista de (salida|inscritos)|liste des? (d[ée]part|engag[ée]s)|engag[ée]s|lista di partenza|start ?list/i;
const TRI_DOMAIN = /triathlon|tri-mag|tri2b|challenge-roth|triathlete|slowtwitch|220triathlon|triatlonnoticias|trimes|tri-today|thetriathlete|trimax|ironman/i;

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers }, signal: ctrl.signal, ...opts });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** name(norm) → athlete id, from every roster source we already have. */
async function knownRoster() {
  const map = new Map();
  const add = (name, id) => { if (name && id && name.includes(' ')) map.set(norm(name), id); };
  for (const f of ['src/data/proAthletes.json', 'src/data/proStartsPTO.json', 'src/data/proStartsMedia.json']) {
    try { for (const a of JSON.parse(await readFile(resolve(ROOT, f), 'utf8')).athletes ?? []) add(a.name, a.id); } catch { /* */ }
  }
  const mocks = await readFile(resolve(ROOT, 'src/mocks/athletes.ts'), 'utf8').catch(() => '');
  for (const m of mocks.matchAll(/id: '([^']+)',\s*name: '([^']+)'/g)) add(m[2], m[1]);
  return map;
}

// --- Discovery A: upcoming races from the PTO calendar + open-web search --------
const MONTH = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const SERIES_BY_BRAND = { t100: 't100', im: 'ironman', im703: 'ironman703', '703': 'ironman703', challenge: 'challenge', pto: 'pto' };
function parseEnDate(s) {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m || !MONTH[m[2].toLowerCase()]) return null;
  return `${m[3]}-${String(MONTH[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}
async function upcomingRaces(now, until) {
  const html = (await get('https://stats.protriathletes.org/pro-race-calendar')) || '';
  const races = [];
  for (const b of html.split(/class="event sortable-item/).slice(1)) {
    const link = b.match(/href="\/race\/([a-z0-9-]+)\/(\d{4})(?:\/[a-z]+)?">([^<]+)</);
    const date = parseEnDate((b.match(/col-date[^>]*>([^<]+)</) || [])[1] || '');
    if (!link || !date) continue;
    const t = +new Date(date);
    if (t < now || t > until) continue;
    races.push({ name: link[3].trim(), year: link[2], date, series: SERIES_BY_BRAND[(b.match(/brand-([a-z0-9]+)/) || [])[1]] });
  }
  return races;
}

// Every race shown under Events → "Serien" (IRONMAN / 70.3 / Challenge / T100). We
// drive discovery off THIS list so the user sees a pro field for all of them, not just
// the few that happen to be on the PTO calendar.
async function seriesRaces() {
  const src = await readFile(resolve(ROOT, 'src/mocks/seriesEvents.ts'), 'utf8').catch(() => '');
  const SMAP = { 'IRONMAN 70.3': 'ironman703', IRONMAN: 'ironman', Challenge: 'challenge', T100: 't100' };
  const races = [];
  for (const m of src.matchAll(/name:\s*'([^']+)'[\s\S]*?series:\s*'([^']+)'[\s\S]*?date:\s*'([^']+)'/g)) {
    const date = m[3].slice(0, 10);
    races.push({ name: m[1], year: date.slice(0, 4), date, series: SMAP[m[2]] });
  }
  return races;
}
// --- Discovery A: race field articles from media sitemaps (direct fetch) --------
// Open-web SERP scraping (DuckDuckGo/Bing) is blocked from CI datacenter IPs, so we
// read publishers' sitemaps directly — that DOES work from Actions — and match field
// articles to upcoming races by host-city token + year. triathlon.de covers German +
// major international races, often in prose the table parsers can't read but Haiku
// can, e.g. "challenge-roth-2026-das-staerkste-profifeld-aller-zeiten".
// Publisher sitemaps. triathlon.de (DE) covers German + major races; triatlonnoticias
// (ES) covers Spanish + many international IRONMAN/Challenge/T100 fields that German
// media skip (e.g. "ironman-lanzarote-2026-start-list"). A sitemap-INDEX is expanded to
// its most recent sub-sitemaps. Add more publishers (FR/IT/EN) here to widen coverage.
const SITEMAPS = [
  'https://triathlon.de/sitemap_blogs_1.xml',
  'https://www.triatlonnoticias.com/sitemap_index.xml',
];
// Field-article markers across languages (DE/EN/ES/FR/IT).
const FIELD_RE = /starterfeld|startliste|start-?list|elitefeld|profifeld|profi-?feld|favoriten|favoritos|\bprofi\b|salida|inscritos|engag[ée]s|lista-?de-?(salida|partenza)|previa/i;
const GENERIC_TOK = new Set([
  'ironman', 'im', 'challenge', 't100', 'wtcs', 'pto', 'triathlon', 'world',
  'european', 'championship', 'series', 'pro', 'profi', 'feld', 'das', 'der',
  'die', 'the', 'of', 'und', 'and', 'staerkste', 'aller', 'zeiten', 'profifeld',
]);
function cityTokens(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !/^\d+$/.test(t) && !GENERIC_TOK.has(t));
}
async function fieldArticles() {
  const urls = new Set();
  for (const sm of SITEMAPS) {
    const xml = (await get(sm)) || '';
    // A sitemap index points at sub-sitemaps — expand the most recent POST sitemaps
    // (the index lists category/author/page sitemaps too; we only want article posts).
    const subs = [...xml.matchAll(/<loc>\s*([^<\s]+\.xml)\s*<\/loc>/g)].map((m) => m[1]);
    const posts = subs.filter((s) => /post|article|news|blog/i.test(s));
    let body = subs.length ? '' : xml;
    for (const sub of (posts.length ? posts : subs).slice(-3)) body += (await get(sub)) || '';
    for (const m of body.matchAll(/https?:\/\/[^\s<]+/g)) {
      const u = m[0];
      if (TRI_DOMAIN.test(u) && FIELD_RE.test(u) && !/\.(jpg|jpeg|png|webp|gif|svg)/i.test(u)) urls.add(u);
    }
  }
  return [...urls];
}

// --- Feed parsing (Discovery B) ----------------------------------------------
function feedItems(xml) {
  return xml.split(/<(?:item|entry)\b/i).slice(1).map((b) => ({
    title: (b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '',
    link: (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || (b.match(/<link>([^<]+)<\/link>/i) || [])[1] || '',
  }));
}

const stripDate = (raw) => { try { const o = JSON.parse(raw); delete o.generatedAt; return JSON.stringify(o); } catch { return raw; } };

async function extractWithHaiku(text, ctx) {
  const prompt = ctx
    ? `This article should be about the PROFESSIONAL field for the triathlon race "${ctx.name}" (${ctx.date}). It may be a formal start list OR a preview/field announcement that names the pros.
FIRST verify it is actually about THIS race. A city can host several different events — if the article is about a DIFFERENT race (e.g. a World Triathlon Cup / a different distance / a different year), return {"isStartList":false}.
Otherwise list EVERY professional/elite athlete the article names as racing / starting / entered / confirmed for THIS race. Return STRICT JSON:
{"isStartList":true,"race":"${ctx.name}","date":"${ctx.date}","series":"ironman|ironman703|challenge|t100|wtcs|null","athletes":[{"name":"First Last","country":"ISO-2 or null","gender":"men|women|null"}]}
Rules: ELITE/PRO only, never age groupers. Use ONLY full names literally in the text — never invent. INCLUDE someone only if the text says they ARE racing this event; EXCLUDE anyone described as absent, withdrawn, skipping, injured, or named only as a PAST winner. If the article names no pro starters for this race, return {"isStartList":false}. JSON only.

ARTICLE:
${text.slice(0, 9000)}`
    : `If the text below is a PROFESSIONAL/ELITE triathlon start list (pros entered for a specific race), return STRICT JSON:
{"isStartList":true,"race":"<race name>","date":"YYYY-MM-DD or null","series":"ironman|ironman703|challenge|t100|wtcs|null","athletes":[{"name":"First Last","country":"ISO-2 or null","gender":"men|women|null"}]}
Rules: ELITE/PRO only, never age groupers. Use ONLY names literally in the text — never invent. If it is NOT a pro start list, return {"isStartList":false}. JSON only.

ARTICLE:
${text.slice(0, 8000)}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) { console.log(`   LLM HTTP ${res.status}`); return null; }
  const raw = ((await res.json()).content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(raw); } catch { return null; }
}

async function main() {
  if (!KEY) { console.log('ANTHROPIC_API_KEY not set → LLM start-list layer skipped (optional).'); return; }
  const now = Date.now() - 864e5;
  const until = now + 400 * 864e5;
  const todayISO = new Date(now).toISOString().slice(0, 10);

  const roster = await knownRoster();
  const seenObj = JSON.parse(await readFile(SEEN, 'utf8').catch(() => '{"seen":[]}'));
  const seen = new Set(seenObj.seen || []);

  // Build the job list. Race universe = EVERY series-tab race (future-dated) ∪ the PTO
  // calendar window, deduped by city+year (the series entry wins — our canonical name).
  // The sitemap match itself is free (no LLM), so attempting all series races is cheap;
  // only races with a published field article incur a Haiku call.
  const jobs = [];
  const series = (await seriesRaces()).filter((r) => +new Date(r.date) >= now);
  const pto = await upcomingRaces(now, now + RACE_WINDOW_DAYS * 864e5);
  const byKey = new Map();
  for (const r of [...series, ...pto]) {
    const k = `${cityTokens(r.name).slice().sort().join('-')}|${r.year}`;
    if (k !== `|${r.year}` && !byKey.has(k)) byKey.set(k, r);
  }
  const races = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
  const articles = await fieldArticles();
  console.log(`Per-race discovery: ${races.length} races · ${articles.length} field-article candidates in sitemaps`);
  for (const race of races) {
    const toks = cityTokens(race.name);
    if (!toks.length) continue;
    const hits = articles.filter((u) => {
      const lo = u.toLowerCase();
      if (!toks.some((c) => lo.includes(c))) return false;
      // accept the target year, or a year-less URL; reject a different explicit edition
      const years = lo.match(/\b20\d{2}\b/g) || [];
      return years.length === 0 || years.includes(String(race.year));
    });
    // Prefer explicit start-list articles over looser previews.
    const score = (u) => (/start-?list|startliste|starterfeld|profifeld|profi-?feld|lista-?de/i.test(u) ? 0 : 1);
    hits.sort((a, b) => score(a) - score(b));
    for (const url of hits.slice(0, 3)) jobs.push({ url: url.split('?')[0], ctx: race });
  }
  console.log(`Per-race discovery queued ${jobs.length} candidate URLs from sitemaps`);
  try {
    const { feeds } = JSON.parse(await readFile(FEEDS, 'utf8'));
    for (const feed of feeds) {
      const xml = await get(feed.rss);
      if (!xml) continue;
      for (const it of feedItems(xml).filter((i) => i.link && TITLE_RE.test(i.title)).slice(0, 25)) {
        jobs.push({ url: it.link.split('?')[0], ctx: null });
      }
    }
  } catch { /* */ }

  const starts = {};
  let calls = 0;
  const processed = new Set();
  for (const job of jobs) {
    if (calls >= MAX_LLM_CALLS) { console.log('· reached MAX_LLM_CALLS, stopping'); break; }
    // Feed articles are read once (seen-cache); per-race field articles are re-read
    // every run so growing fields stay fresh.
    if (processed.has(job.url) || (seen.has(job.url) && !job.ctx)) continue;
    processed.add(job.url);
    const html = await get(job.url);
    seen.add(job.url); // processed once, regardless of outcome
    if (!html) continue;
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const nocs = (text.match(/\b[A-Z]{3}\b/g) || []).length;
    if (!TITLE_RE.test(text) && nocs < 12) continue; // free pre-filter

    calls++;
    const data = await extractWithHaiku(text, job.ctx);
    if (!data?.isStartList || !Array.isArray(data.athletes)) { console.log(`· ${job.url.slice(0, 55)}: not a start list`); continue; }
    // catalog date wins in per-race mode (reliable); else the LLM's, validated future
    const date = job.ctx?.date || data.date;
    if (!date || date < todayISO || +new Date(date) > until) { console.log(`· ${data.race || job.ctx?.name}: no plausible future date → skip`); continue; }
    const series = job.ctx?.series || (data.series && data.series !== 'null' ? data.series : undefined);
    const event = job.ctx?.name || data.race;
    let kept = 0;
    for (const a of data.athletes) {
      const id = roster.get(norm(a.name || ''));
      if (!id) continue; // only known pros → no hallucinated athletes
      const list = (starts[id] ??= []);
      if (list.some((s) => s.date === date)) continue; // one race per athlete per day
      list.push({ date, event, ...(series ? { series } : {}), url: job.url, confidence: 'confirmed' });
      kept++;
    }
    console.log(`· ${event} (${date}): ${data.athletes.length} parsed, ${kept} known pros${job.ctx ? ' [search]' : ' [feed]'}`);
  }

  const out = { generatedAt: new Date().toISOString(), note: 'Pro starts extracted by the LLM robot from per-race web search + multi-language media feeds (only athletes already in our roster → no new/hallucinated athletes). confidence confirmed. Merged on top of curated + WTCS + PTO + media.', starts };
  const prev = await readFile(OUT, 'utf8').catch(() => '');
  if (stripDate(JSON.stringify(out)) !== stripDate(prev)) await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  await writeFile(SEEN, JSON.stringify({ note: seenObj.note, seen: [...seen] }, null, 2) + '\n');
  const total = Object.values(starts).reduce((n, l) => n + l.length, 0);
  console.log(`\nLLM calls: ${calls}/${MAX_LLM_CALLS}. Wrote ${total} starts for ${Object.keys(starts).length} known pros → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
