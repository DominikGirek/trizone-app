/**
 * Tobi · roster — the athlete-slug universe, in two tiers:
 *
 *  • `canonical` — the slugs that TIPS and SCORING actually reference: the curated roster
 *    (src/mocks/athletes.ts) + the tippable fields (the picker's pool) + verified past results. These are
 *    "gold": what Tobi must publish so a user's pick lines up with the result.
 *  • `known` — the broad UNION that also includes scraped start-list spellings (PTO/media/LLM/MIKA/WTCS).
 *    Used only to tell "real athlete, different spelling" from "genuinely never seen".
 *
 * A finisher slug that resolves to neither (see canonical.mjs) is NEVER invented into a result: Tobi
 * stages it and pings (docs/robot-fleet.md — data integrity is heilig).
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = (f) => resolve(ROOT, 'src/data', f);

// Scraped pro rosters — shape: { athletes: [{ id, gender? }], starts?: { slug: [...] } }. KNOWN, not gold.
const JSON_ROSTERS = [
  'proAthletes.json',
  'proStartsPTO.json',
  'proStartsMedia.json',
  'proStartsLlm.json',
  'proStartsMika.json',
  'proStartsIronman.json',
];

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}
async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

// Slug-shaped, quoted tokens from a TS/JSON blob: start with a letter, contain a hyphen (skips dates,
// numeric ids, and the dotted/slashed `source` URLs, which never match as a single token).
function slugTokens(text) {
  const out = [];
  for (const m of text.matchAll(/['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)['"]/g)) out.push(m[1]);
  return out;
}

/**
 * @returns {Promise<{ known: Set<string>, canonical: Set<string>, gender: Map<string,'men'|'women'> }>}
 */
export async function loadRoster() {
  const known = new Set();
  const canonical = new Set();
  const gender = new Map();
  const addKnown = (slug, g) => {
    if (!slug) return;
    known.add(slug);
    if ((g === 'men' || g === 'women') && !gender.has(slug)) gender.set(slug, g);
  };
  const addCanonical = (slug) => {
    if (!slug) return;
    canonical.add(slug);
    known.add(slug);
  };

  // GOLD · curated roster — one athlete per line: `{ id: 'slug', ... gender: 'men' ... }`.
  const mocks = await readText(resolve(ROOT, 'src/mocks/athletes.ts'));
  for (const line of mocks.split('\n')) {
    const id = line.match(/id:\s*'([a-z0-9-]+)'/);
    if (!id) continue;
    const g = line.match(/gender:\s*'(men|women)'/);
    addCanonical(id[1]);
    if (g) gender.set(id[1], g[1]);
  }

  // GOLD · tippable fields (the picker's pool) + verified results (what scoring compares against).
  for (const f of ['tippableFields.ts', 'raceResults.json']) {
    for (const slug of slugTokens(await readText(DATA(f)))) addCanonical(slug);
  }

  // KNOWN · scraped pro rosters (WTCS + all start-list robots) — real athletes, possibly non-canonical spelling.
  for (const f of JSON_ROSTERS) {
    const j = await readJson(DATA(f));
    if (!j) continue;
    for (const a of j.athletes || []) addKnown(a.id, a.gender);
    for (const slug of Object.keys(j.starts || {})) addKnown(slug);
  }

  return { known, canonical, gender };
}
