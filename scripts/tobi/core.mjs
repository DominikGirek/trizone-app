/**
 * Tobi · core — turns adapter outputs into a VERDICT + a `robot_runs` record.
 *
 * Safety rules (docs/robot-fleet.md §4/§5 — data integrity is heilig):
 *   • every finisher slug must resolve to a CANONICAL slug (the spelling tips + scoring use) via
 *     alias → canonical → transliteration-normalised (canonical.mjs). Unresolved ⇒ STAGE, never invent.
 *   • each EXPECTED gender must have a complete top-N (so a both-gender race is never published half-done,
 *     which would mis-score the missing gender as 0).
 *   • AUTO-PUBLISH confidence — HYBRID (user-chosen): either
 *       (a) CROSS-SOURCE: ≥ minSources sources agree on the identical resolved top-N, OR
 *       (b) TEMPORAL: a single source is STABLE — the previous run produced the identical result AND was
 *           ≥ minStableMs ago (a finalised result doesn't change hour to hour).
 *   • anything short ⇒ status 'stage' (logged; next run can confirm stability). No live source ⇒ 'fail'.
 *
 * Pure function — the caller supplies `now`, `previousRun`, aliases, roster. No network, no fs.
 */
import { buildCanonicalIndex, resolveCanonical } from './canonical.mjs';

/** @typedef {'publish'|'stage'|'fail'} TobiStatus */

const sameList = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

function resolveList(list, deps) {
  const resolved = [];
  const unknown = [];
  for (const raw of list) {
    const r = resolveCanonical(raw, deps);
    resolved.push(r.slug);
    if (r.how === 'unknown') unknown.push(raw);
  }
  return { resolved, unknown };
}

/**
 * @param {{ raceId:string, genders:Array<'men'|'women'>, sources:Array<{source:string, ok:boolean, url?:string, men?:string[], women?:string[]}> }} input
 * @param {{ aliases:Record<string,string>, roster:{canonical:Set<string>}, byNorm?:Map<string,Set<string>>,
 *           minSources?:number, topN?:number, previousRun?:{men?:string[],women?:string[],ran_at?:string}|null,
 *           now?:number, minStableMs?:number }} deps
 */
export function evaluate(input, deps) {
  const { raceId, genders, sources } = input;
  const {
    aliases = {},
    roster,
    minSources = 2,
    topN = 5,
    previousRun = null,
    now = Date.now(),
    minStableMs = 45 * 60 * 1000,
  } = deps;
  const byNorm = deps.byNorm || buildCanonicalIndex(roster.canonical);
  const resolveDeps = { aliases, canonical: roster.canonical, byNorm };

  const live = sources.filter((s) => s && s.ok);
  const perGender = {};
  const unknownSlugs = [];
  let allKnown = true;
  let allAgree = true;
  let allComplete = true;

  for (const g of genders) {
    const lists = live.map((s) => {
      const { resolved, unknown } = resolveList((s[g] || []).slice(0, topN), resolveDeps);
      if (unknown.length) {
        allKnown = false;
        for (const u of unknown) unknownSlugs.push({ gender: g, slug: u, source: s.source });
      }
      return { source: s.source, resolved };
    });
    const complete = lists.length > 0 && lists[0].resolved.length === topN;
    const agree = lists.length >= minSources && lists.every((l) => sameList(l.resolved, lists[0].resolved));
    if (!complete) allComplete = false;
    if (!agree) allAgree = false;
    perGender[g] = { candidate: lists[0]?.resolved || [] };
  }

  const result = {};
  for (const g of genders) result[g] = perGender[g].candidate;

  // Confidence axes (only meaningful once the base gates pass).
  const crossSource = live.length >= minSources && allAgree;
  const prevMatches =
    !!previousRun && genders.every((g) => sameList(result[g] || [], previousRun[g] || []));
  const prevOldEnough =
    !!previousRun && !!previousRun.ran_at && now - Date.parse(previousRun.ran_at) >= minStableMs;
  const temporal = prevMatches && prevOldEnough;

  /** @type {TobiStatus} */
  let status;
  let reason;
  if (!live.length) {
    status = 'fail';
    reason = 'keine Quelle lieferte Daten';
  } else if (!allKnown) {
    status = 'stage';
    reason = `unbekannte Slugs: ${unknownSlugs.map((u) => u.slug).join(', ')}`;
  } else if (!allComplete) {
    status = 'stage';
    reason = `unvollständig (weniger als ${topN} Finisher je Kategorie)`;
  } else if (crossSource) {
    status = 'publish';
    reason = `${live.length} Quellen einig, alle Slugs kanonisch`;
  } else if (temporal) {
    status = 'publish';
    reason = 'stabil über 2 Läufe (Ergebnis final), alle Slugs kanonisch';
  } else {
    status = 'stage';
    reason = prevMatches
      ? 'stabil, aber noch nicht lange genug — Bestätigung im nächsten Lauf'
      : live.length < minSources
        ? 'nur 1 Quelle — warte auf 2. Quelle oder Bestätigung im nächsten Lauf'
        : 'Quellen uneinig';
  }

  return {
    raceId,
    status,
    reason,
    result, // { men?:[...], women?:[...] } — canonical candidate (may be staged, never invented)
    unknownSlugs,
    sources: live.map((s) => ({ source: s.source, url: s.url })),
    run: {
      robot: 'tobi',
      race_id: raceId,
      status,
      confidence: status === 'publish' ? 100 : allKnown && allComplete ? 60 : 0,
      men: result.men || [],
      women: result.women || [],
      source_count: live.length,
      unknown_slugs: unknownSlugs.map((u) => u.slug),
      note: reason,
    },
  };
}
