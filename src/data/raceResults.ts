import raceResultsData from '@/data/raceResults.json';

/**
 * VERIFIED finishing results for tippable races — the input to scoring. The top 5 per gender is enough
 * (that's all a tip covers). Athletes are referenced by the app's stable slug id (e.g. "patrick-lange")
 * so they line up exactly with the picks. `raceId` is the app race id (the "se-…" series id) so it
 * matches predictions.race_id one-to-one.
 *
 * HARD RULE (see [[data-integrity]]): only ever add results confirmed against an official/reputable
 * source — `source` + `verifiedAt` are mandatory. Never guess an order or invent a finisher.
 *
 * This bundled file feeds the in-app "your tip vs. result" view. The SAME data is pushed to Supabase
 * `race_results` (so the global/group leaderboards score) by scripts/sync-race-results.mjs.
 */
export interface VerifiedRaceResult {
  raceId: string;
  /** Top-5 men's slugs, winner first. */
  men: string[];
  /** Top-5 women's slugs, winner first. */
  women: string[];
  /** Where the result was verified (official results page / reputable report). */
  source: string;
  /** ISO date the result was confirmed. */
  verifiedAt: string;
}

const results = (raceResultsData as { results: VerifiedRaceResult[] }).results;
const byId: Record<string, VerifiedRaceResult> = Object.fromEntries(results.map((r) => [r.raceId, r]));

/** Verified result for a race, or undefined if not scored yet. */
export function getRaceResult(raceId: string): VerifiedRaceResult | undefined {
  return byId[raceId];
}

export function allRaceResults(): VerifiedRaceResult[] {
  return results;
}
