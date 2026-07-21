/**
 * Tobi · roster — the universe of KNOWN athlete slugs (+ gender where known).
 *
 * A finisher slug that isn't in here is NEVER invented into a result: Tobi stages it and pings Dominik
 * (see docs/robot-fleet.md — data integrity is heilig). The roster is the UNION of every source the app
 * can already render an athlete from, so a legit pro almost always resolves and only genuinely-new names
 * get flagged.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = (f) => resolve(ROOT, 'src/data', f);

// JSON pro rosters — shape: { athletes: [{ id, gender? }], starts?: { slug: [...] } }
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

/**
 * Build the known-slug set + a best-effort gender map.
 * @returns {Promise<{ slugs: Set<string>, gender: Map<string, 'men'|'women'> }>}
 */
export async function loadRoster() {
  const slugs = new Set();
  const gender = new Map();
  const add = (slug, g) => {
    if (!slug) return;
    slugs.add(slug);
    if ((g === 'men' || g === 'women') && !gender.has(slug)) gender.set(slug, g);
  };

  // Curated source of truth — one athlete per line: `{ id: 'slug', ... gender: 'men' ... }`.
  const mocks = await readText(resolve(ROOT, 'src/mocks/athletes.ts'));
  for (const line of mocks.split('\n')) {
    const id = line.match(/id:\s*'([a-z0-9-]+)'/);
    if (!id) continue;
    const g = line.match(/gender:\s*'(men|women)'/);
    add(id[1], g?.[1]);
  }

  // JSON pro rosters (WTCS + all start-list robots).
  for (const f of JSON_ROSTERS) {
    const j = await readJson(DATA(f));
    if (!j) continue;
    for (const a of j.athletes || []) add(a.id, a.gender);
    for (const slug of Object.keys(j.starts || {})) add(slug);
  }

  return { slugs, gender };
}
