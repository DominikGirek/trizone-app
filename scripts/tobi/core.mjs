/**
 * Tobi · core — turns adapter outputs into a VERDICT + a `robot_runs` record.
 *
 * Safety rules (docs/robot-fleet.md §4/§5 — data integrity is heilig):
 *   • every finisher slug must resolve (via alias) to a KNOWN roster slug. Unknown ⇒ STAGE + ping,
 *     never invent a finisher.
 *   • AUTO-PUBLISH only when ≥ minSources sources AGREE on the identical top-N per gender, AND all slugs
 *     are known, AND each expected gender has a complete top-N.
 *   • anything short ⇒ status 'stage' (lands in the approval inbox, pings Dominik).
 *   • no live source at all ⇒ status 'fail'.
 *
 * Pure function — no network, no fs, no clock. The caller stamps `ran_at` and does any writing.
 */

/** @typedef {'publish'|'stage'|'fail'} TobiStatus */

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function resolveList(list, aliases, roster) {
  const resolved = [];
  const unknown = [];
  for (const raw of list) {
    const slug = aliases[raw] || raw;
    resolved.push(slug);
    if (!roster.slugs.has(slug)) unknown.push(raw);
  }
  return { resolved, unknown };
}

/**
 * @param {{ raceId:string, genders:Array<'men'|'women'>, sources:Array<{source:string, ok:boolean, url?:string, men?:string[], women?:string[]}> }} input
 * @param {{ aliases:Record<string,string>, roster:{slugs:Set<string>}, minSources?:number, topN?:number }} deps
 */
export function evaluate(input, deps) {
  const { raceId, genders, sources } = input;
  const { aliases = {}, roster, minSources = 2, topN = 5 } = deps;

  const live = sources.filter((s) => s && s.ok);
  const perGender = {};
  const unknownSlugs = [];
  let allKnown = true;
  let allAgree = true;
  let allComplete = true;

  for (const g of genders) {
    const lists = live.map((s) => {
      const { resolved, unknown } = resolveList((s[g] || []).slice(0, topN), aliases, roster);
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
    perGender[g] = { candidate: lists[0]?.resolved || [], agree, complete };
  }

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
    reason = `unvollständig (weniger als ${topN} Finisher)`;
  } else if (live.length < minSources) {
    status = 'stage';
    reason = `nur ${live.length} Quelle — brauche ≥${minSources} übereinstimmende für Auto-Publish`;
  } else if (!allAgree) {
    status = 'stage';
    reason = 'Quellen uneinig';
  } else {
    status = 'publish';
    reason = `${live.length} Quellen einig, alle Slugs bekannt`;
  }

  const result = {};
  for (const g of genders) result[g] = perGender[g].candidate;

  return {
    raceId,
    status,
    reason,
    result, // { men?:[...], women?:[...] } — best candidate (may be staged, never invented)
    unknownSlugs,
    sources: live.map((s) => ({ source: s.source, url: s.url })),
    // A row for the Supabase `robot_runs` table (the Cockpit reads this). Caller adds `ran_at`.
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
