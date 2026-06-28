/**
 * Curated PRO start lists ("fields") for tippable races that don't yet surface a live start list from the
 * athlete pipeline. Race-centric (like raceResults): each entry is the verified, ANNOUNCED pro field —
 * athlete slugs per gender, from the official start list / a reputable source. The Tipp picker builds its
 * pool from this when no live start list exists.
 *
 * HARD RULE (data-integrity): only real, entered athletes — never invent a field. Every slug must exist in
 * the roster (src/mocks/athletes.ts) so names render. `source` + `verifiedAt` are mandatory. A race whose
 * field isn't published yet simply stays "Startliste folgt".
 */
export interface TippableField {
  raceId: string;
  men: string[];
  women: string[];
  source: string;
  verifiedAt: string;
}

export const tippableFields: TippableField[] = [];

const byId: Record<string, TippableField> = Object.fromEntries(tippableFields.map((f) => [f.raceId, f]));

/** Curated pro field for a race, or undefined if none is curated. */
export function getTippableField(raceId: string): TippableField | undefined {
  return byId[raceId];
}

/** Race ids that have a curated field (for the funnel's "tippable now" check). */
export function curatedFieldIds(): string[] {
  return tippableFields.map((f) => f.raceId);
}
