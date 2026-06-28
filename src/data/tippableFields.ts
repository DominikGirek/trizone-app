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
  /** True if the field is a pre-race provisional/tentative start list (may still change). */
  provisional?: boolean;
}

export const tippableFields: TippableField[] = [
  {
    // T100 Vancouver is a WOMEN-only pro race in 2026; this is the published *tentative* field (refresh
    // closer to the race / via Tobi). Withdrawals just score 0; the podium contenders are all on it.
    raceId: 'se-t100-vancouver',
    men: [],
    women: [
      'alanis-siffert', 'nicole-van-der-kaay', 'taylor-spivey', 'sara-perez-sala', 'holly-lawrence',
      'lotte-wilms', 'daniela-kleiser', 'lizzie-rayner', 'ellie-salthouse', 'hanne-de-vet',
      'audrey-merle', 'hannah-berry', 'lisa-perterer', 'marjolaine-pierre', 'rebecca-anderbury',
      'leana-bissig', 'grace-alexander',
    ],
    source: 'stats.protriathletes.org/race/vancouver-t100/2026/participants (tentative)',
    verifiedAt: '2026-06-28',
    provisional: true,
  },
];

const byId: Record<string, TippableField> = Object.fromEntries(tippableFields.map((f) => [f.raceId, f]));

/** Curated pro field for a race, or undefined if none is curated. */
export function getTippableField(raceId: string): TippableField | undefined {
  return byId[raceId];
}

/** Race ids that have a curated field (for the funnel's "tippable now" check). */
export function curatedFieldIds(): string[] {
  return tippableFields.map((f) => f.raceId);
}
