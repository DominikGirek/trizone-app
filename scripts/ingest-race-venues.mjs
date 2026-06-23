/**
 * Race venue ingest — the REAL swim-start coordinates per race (for the "Karte" button).
 *
 * There is no structured feed of triathlon swim-start GPS, and event NAMES don't geocode
 * (triathlons aren't tagged as places in OSM). But the swim VENUE (a named lake/river/sea)
 * does geocode reliably. So:
 *   1. Haiku proposes the swim-start venue NAME for each race (it knows the famous ones);
 *      it is told to answer "null" when unsure — never guess.
 *   2. OpenStreetMap Nominatim geocodes "<venue> <town>" → real, verifiable coordinates.
 *   3. SANITY GATE: the result must be within MAX_KM of the event's known town centroid.
 *      This rejects an LLM-invented venue (won't geocode / lands far away) AND the
 *      organizer HQ in another city. Only verified coordinates are written.
 *
 * Keyed by city token(s) (date-independent — a city's swim venue rarely moves). Merges on
 * top of the curated/existing raceVenues.json. Gated by ANTHROPIC_API_KEY (no-op without).
 *
 * Usage: node scripts/ingest-race-venues.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/raceVenues.json');
const SERIES = resolve(ROOT, 'src/mocks/seriesEvents.ts');
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_KM = 25; // a swim start this far from the town centroid is almost certainly wrong
const UA = 'TriZone/1.0 (triathlon app; contact dgirek@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GENERIC = new Set([
  'ironman', 'im', 'challenge', 't100', 'wtcs', 'pto', 'triathlon', 'world', 'european',
  'europe', 'championship', 'championships', 'series', 'pro', 'professional', 'elite', 'men',
  'women', 'mixed', 'relay', 'sprint', 'middle', 'long', 'distance', 'cup', 'open', 'race',
  'the', 'of', 'und', 'am', 'main', 'presented', 'powered', 'by', 'datev', 'mainova', 'sokin',
  'ekoi', 'isuzu', 'intermarche', 'vinfast', 'alga', 'french', 'riviera', 'france', 'germany',
  'deutschland', 'switzerland', 'schweiz', 'austria', 'oesterreich', 'italy', 'italia', 'spain',
  'espana', 'uk', 'usa',
]);
const cityKey = (name) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((t) => t.length > 2 && !/^\d+$/.test(t) && !GENERIC.has(t)).sort().join('-');

const km = (aLat, aLon, bLat, bLon) => {
  const R = 6371, d = (x) => (x * Math.PI) / 180;
  const s = Math.sin(d(bLat - aLat) / 2) ** 2 +
    Math.cos(d(aLat)) * Math.cos(d(bLat)) * Math.sin(d(bLon - aLon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

async function get(url, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Races that have a detail page + a map button = the series events (with town + centroid).
async function seriesRaces() {
  const src = await readFile(SERIES, 'utf8');
  const races = [];
  const re = /name:\s*'([^']+)'[\s\S]*?town:\s*'([^']+)'[\s\S]*?lat:\s*([\d.-]+),\s*lon:\s*([\d.-]+)/g;
  for (const m of src.matchAll(re)) {
    races.push({ name: m[1], town: m[2], lat: +m[3], lon: +m[4] });
  }
  return races;
}

async function venueName(race) {
  const prompt = `What is the SWIM START venue for the triathlon "${race.name}" in ${race.town}? The swim start is a specific lake, river, canal, harbour or beach (e.g. "Langener Waldsee", "Main-Donau-Kanal Hilpoltstein", "Binnenalster"). Reply STRICT JSON: {"venue":"<water body + town/place, or null if you are not confident>"}. NEVER guess and NEVER return the organizer's office. JSON only.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const raw = ((await res.json()).content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  try {
    const v = JSON.parse(raw).venue;
    return v && v !== 'null' ? String(v) : null;
  } catch {
    return null;
  }
}

async function geocode(query) {
  const h = await get(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
  try {
    const a = JSON.parse(h || '[]');
    return a[0] ? { lat: +a[0].lat, lon: +a[0].lon, cls: `${a[0].class}/${a[0].type}` } : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!KEY) {
    console.log('ANTHROPIC_API_KEY not set → race-venue layer skipped (optional).');
    return;
  }
  const existing = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{"venues":{}}'));
  const venues = existing.venues || {};
  const races = await seriesRaces();
  console.log(`Series races with a map button: ${races.length}`);

  let added = 0;
  for (const race of races) {
    const key = cityKey(race.name);
    if (!key || venues[key]) continue; // keep curated/already-known venues
    const name = await venueName(race);
    if (!name) {
      console.log(`· ${race.name}: no confident venue`);
      continue;
    }
    await sleep(1100); // Nominatim: <=1 req/s
    const geo = await geocode(`${name}`);
    if (!geo) {
      console.log(`· ${race.name}: "${name}" did not geocode`);
      continue;
    }
    const dist = km(race.lat, race.lon, geo.lat, geo.lon);
    if (dist > MAX_KM) {
      console.log(`· ${race.name}: "${name}" geocoded ${dist.toFixed(0)} km from town → rejected`);
      continue;
    }
    venues[key] = {
      lat: +geo.lat.toFixed(5),
      lon: +geo.lon.toFixed(5),
      label: `Schwimmstart ${name}`,
      source: `OSM: ${name} (${geo.cls}, ${dist.toFixed(1)} km from centre)`,
    };
    added++;
    console.log(`· ${race.name}: ${name} → ${venues[key].lat},${venues[key].lon} (${dist.toFixed(1)} km) ✓`);
    await sleep(300);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    note: existing.note ||
      'Verified SWIM-START coordinates per race, keyed by city token(s). Geocoded from the real swim-venue name via OSM Nominatim, validated within ~25 km of the town. Never the organizer. Robot: scripts/ingest-race-venues.mjs.',
    venues,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(venues).length} venues (+${added} new) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
