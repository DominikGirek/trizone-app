/**
 * Pro start lists ingest — Stage 4 (multi-magazine, multi-language, via LLM).
 *
 * The scalable layer: instead of a parser per magazine, we scan magazine RSS/Atom
 * feeds (proStartFeeds.json, any language) for "start list" articles and let a
 * small LLM (Claude Haiku) extract the field from ANY format/language. Reliability
 * guards so it can't drift or explode:
 *   - NO KEY → no-op (the whole layer is optional).
 *   - Only items whose TITLE looks like a start list, that pass a free pre-filter,
 *     and that we haven't processed before (seen-cache) reach the model.
 *   - Hard ceiling MAX_LLM_CALLS per run; tiny trimmed input; Haiku (cheapest).
 *   - Extracted athletes are kept ONLY if they match an athlete we already have
 *     (curated + WTCS + PTO + media) → no hallucinated/new athletes. This layer
 *     CONFIRMS known pros' starts from foreign-language media earlier; roster
 *     growth stays with the structured robots.
 *   - The race date must be a plausible future date.
 * Cost: a handful of Haiku calls/week → cents. Set a hard spend cap in the
 * Anthropic console as the absolute backstop.
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
const MAX_LLM_CALLS = Number(process.env.TRIZONE_LLM_MAX_CALLS || 12); // hard cost ceiling / run
const MAX_ITEMS_PER_FEED = 25;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TITLE_RE = /startliste|start[\s-]?list|startlist|starterfeld|profi.?(feld|liste|start)|elite (field|start|wave)|pro (field|start ?list)|lista de (salida|inscritos)|liste des? (d[ée]part|engag[ée]s)|engag[ée]s|lista di partenza|start ?list/i;

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

function feedItems(xml) {
  const blocks = xml.split(/<(?:item|entry)\b/i).slice(1);
  return blocks.map((b) => {
    const title = (b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '';
    const link =
      (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] ||
      (b.match(/<link>([^<]+)<\/link>/i) || [])[1] || '';
    return { title, link };
  });
}

const stripDate = (raw) => { try { const o = JSON.parse(raw); delete o.generatedAt; return JSON.stringify(o); } catch { return raw; } };

async function extractWithHaiku(text, feedName) {
  const prompt = `You are given the text of a triathlon article from ${feedName}. If it is a PROFESSIONAL/ELITE start list (a list of pro athletes entered for a specific race), return STRICT JSON:
{"isStartList":true,"race":"<race name>","date":"YYYY-MM-DD or null","series":"ironman|ironman703|challenge|t100|wtcs|null","athletes":[{"name":"First Last","country":"ISO-2 or null","gender":"men|women|null"}]}
Rules: ELITE/PRO only, never age groupers. Use ONLY names that literally appear in the article — never invent. If it is NOT a pro start list, return {"isStartList":false}. Output JSON only, no prose.

ARTICLE:
${text.slice(0, 8000)}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) { console.log(`   LLM HTTP ${res.status}`); return null; }
  const j = await res.json();
  const raw = (j.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(raw); } catch { return null; }
}

async function main() {
  if (!KEY) {
    console.log('ANTHROPIC_API_KEY not set → LLM start-list layer skipped (optional).');
    return;
  }
  const now = Date.now() - 864e5;
  const until = now + 400 * 864e5;
  const todayISO = new Date(now).toISOString().slice(0, 10);

  const roster = await knownRoster();
  const { feeds } = JSON.parse(await readFile(FEEDS, 'utf8'));
  const seenObj = JSON.parse(await readFile(SEEN, 'utf8').catch(() => '{"seen":[]}'));
  const seen = new Set(seenObj.seen || []);

  const starts = {};
  let calls = 0;
  for (const feed of feeds) {
    const xml = await get(feed.rss);
    if (!xml) { console.log(`· ${feed.name}: feed fetch failed`); continue; }
    const items = feedItems(xml).filter((it) => it.link && TITLE_RE.test(it.title)).slice(0, MAX_ITEMS_PER_FEED);
    for (const it of items) {
      const url = it.link.split('?')[0];
      if (seen.has(url)) continue;
      if (calls >= MAX_LLM_CALLS) { console.log('· reached MAX_LLM_CALLS, stopping'); break; }
      const html = await get(url);
      seen.add(url); // processed once, regardless of outcome
      if (!html) continue;
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      // free pre-filter: needs a start-list keyword + enough nation codes / names
      const nocs = (text.match(/\b[A-Z]{3}\b/g) || []).length;
      if (!TITLE_RE.test(text) && nocs < 12) continue;

      calls++;
      const data = await extractWithHaiku(text, feed.name);
      if (!data?.isStartList || !Array.isArray(data.athletes)) { console.log(`· ${it.title.slice(0, 50)}: not a start list`); continue; }
      if (!data.date || data.date < todayISO || +new Date(data.date) > until) { console.log(`· ${data.race}: no plausible future date → skip`); continue; }
      let kept = 0;
      for (const a of data.athletes) {
        const id = roster.get(norm(a.name || ''));
        if (!id) continue; // only known pros → no hallucinated athletes
        const list = (starts[id] ??= []);
        if (list.some((s) => s.event === data.race)) continue;
        list.push({
          date: data.date,
          event: data.race,
          ...(data.series && data.series !== 'null' ? { series: data.series } : {}),
          url,
          confidence: 'confirmed',
        });
        kept++;
      }
      console.log(`· ${data.race} (${data.date}): ${data.athletes.length} parsed, ${kept} known pros [${feed.name}]`);
    }
  }

  const out = { generatedAt: new Date().toISOString(), note: 'Pro starts extracted by the LLM robot from multi-language media start-list articles (only athletes already in our roster → no new/hallucinated athletes). confidence confirmed. Merged on top of curated + WTCS + PTO + media.', starts };
  // write only if content (excluding generatedAt) changed → no noisy commits
  const prev = await readFile(OUT, 'utf8').catch(() => '');
  if (stripDate(JSON.stringify({ ...out })) !== stripDate(prev)) {
    await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  }
  await writeFile(SEEN, JSON.stringify({ note: seenObj.note, seen: [...seen] }, null, 2) + '\n');
  const total = Object.values(starts).reduce((n, l) => n + l.length, 0);
  console.log(`\nLLM calls: ${calls}/${MAX_LLM_CALLS}. Wrote ${total} starts for ${Object.keys(starts).length} known pros → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
