/**
 * Tippspiel prizes — the OWNER-FILLED scaffold (P5). A prize can hang off a single race (its se-… id)
 * or off the whole season (SEASON key). Everything is optional and the list is EMPTY by default: a prize
 * only ever shows when a real one is entered here. Never invent a sponsor or a prize (data-integrity —
 * the Mainova lesson). Later this can move to a backend table + admin UI; for now the owner edits this file.
 */
export interface TipPrize {
  /** A race id ("se-im-frankfurt") or the season key (SEASON). */
  scope: string;
  /** What's up for grabs, e.g. "Ryzon Renn-Trikot". */
  title: string;
  /** Real sponsor name, if any (optional). */
  sponsor?: string;
  /** One short line of detail (optional). */
  detail?: string;
  /** Sponsor / prize link (optional). */
  url?: string;
}

export const SEASON = 'season-2026';

// ⬇︎ OWNER: add REAL prizes here (and only real ones). Empty = no prize shown anywhere.
export const tipPrizes: TipPrize[] = [];

const byScope: Record<string, TipPrize> = Object.fromEntries(tipPrizes.map((p) => [p.scope, p]));

/** The prize for a race id or the SEASON, or undefined if none configured. */
export function getPrize(scope: string): TipPrize | undefined {
  return byScope[scope];
}
