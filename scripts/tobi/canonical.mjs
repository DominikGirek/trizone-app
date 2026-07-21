/**
 * Tobi · canonical — resolve a SOURCE slug to the app's CANONICAL slug (the one tips + scoring use), so
 * Tobi never publishes a spelling a user's pick wouldn't match (docs/robot-fleet.md, Slice-2 finding).
 *
 * Resolution order (first hit wins):
 *   1. 'alias'      — explicit human-verified map in aliases.json (handles genuine name-spelling diffs
 *                     like carolin-pohle → caroline-pohle that no rule could derive).
 *   2. 'canonical'  — the slug is already gold.
 *   3. 'normalized' — its transliteration-normalised form matches EXACTLY ONE canonical slug (safely
 *                     auto-resolves diacritic diffs like solveig-loevseth → solveig-lovseth). A form that
 *                     is ambiguous (>1 canonical) is NOT auto-resolved — safety over guessing.
 *   4. 'unknown'    — none of the above ⇒ caller stages + pings. Never invent a finisher.
 */

/**
 * Collapse common diacritic transliterations to a comparison key. ø/ö→(oe|o), æ/ä→(ae|a), ü→(ue|u), ß→(ss|s)
 * all fold to the same normal form, so the two spellings of one name line up. Lookup-only — the resolved
 * OUTPUT is always the canonical slug, never this key.
 */
export function normalizeSlug(slug) {
  return slug
    .toLowerCase()
    .replace(/oe/g, 'o')
    .replace(/ae/g, 'a')
    .replace(/ue/g, 'u')
    .replace(/ss/g, 's');
}

/** Build the normalized index once: normKey → Set<canonicalSlug>. Keys with >1 slug are ambiguous. */
export function buildCanonicalIndex(canonical) {
  const byNorm = new Map();
  for (const slug of canonical) {
    const k = normalizeSlug(slug);
    let set = byNorm.get(k);
    if (!set) byNorm.set(k, (set = new Set()));
    set.add(slug);
  }
  return byNorm;
}

/**
 * @param {string} raw  the source-provided slug
 * @param {{ aliases:Record<string,string>, canonical:Set<string>, byNorm:Map<string,Set<string>> }} deps
 * @returns {{ slug:string, how:'alias'|'canonical'|'normalized'|'unknown' }}
 */
export function resolveCanonical(raw, { aliases, canonical, byNorm }) {
  if (aliases[raw]) return { slug: aliases[raw], how: 'alias' };
  if (canonical.has(raw)) return { slug: raw, how: 'canonical' };
  const set = byNorm.get(normalizeSlug(raw));
  if (set && set.size === 1) return { slug: [...set][0], how: 'normalized' };
  return { slug: raw, how: 'unknown' };
}
