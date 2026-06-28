/**
 * Tippspiel scoring — the pure, deterministic heart of the prediction game.
 *
 * Players predict the TOP 5 finishers in order, per gender, from the real start list. A tip is scored
 * exactly ONCE against verified results; every leaderboard (global + each group) is just a filtered
 * sum over these per-race scores ("one tip, many boards").
 *
 * Rules (agreed 2026-06-28) — rewards skill but stays catchable (flat bonuses, never multipliers):
 *   • right athlete on the exact place (1–5):                 +3 each
 *   • right athlete but wrong place (still in the real top 5): +1 each
 *   • PODIUM exact (your top 3 == real top 3, in order):       +3
 *   • ALL FIVE exact:                                          +5
 *   → per gender max 5×3 + 3 + 5 = 23; per race (men+women) max 46.
 *
 * Athletes are referenced by a stable id. DNFs simply never appear in `actual`, so a pick that DNF'd
 * scores nothing — no special-casing, no fabrication. We never score from unverified results.
 */

export const TIP_SIZE = 5;
export const PTS_EXACT = 3;
export const PTS_PARTIAL = 1;
export const BONUS_PODIUM = 3;
export const BONUS_ALL_FIVE = 5;
export const MAX_PER_GENDER = TIP_SIZE * PTS_EXACT + BONUS_PODIUM + BONUS_ALL_FIVE; // 23
export const MAX_PER_RACE = MAX_PER_GENDER * 2; // 46

export type Gender = 'men' | 'women';

/** Ordered athlete ids, position 0 = predicted winner. Up to TIP_SIZE; gaps/short tips are allowed. */
export type Picks = (string | null)[];

export interface RaceTip {
  raceId: string;
  men: Picks;
  women: Picks;
}

/** Verified finishing order (top 5 is enough), position 0 = winner. */
export interface RaceResult {
  raceId: string;
  men: string[];
  women: string[];
}

export interface GenderScore {
  points: number;
  exact: number; // right athlete, right place
  partial: number; // right athlete, wrong place (within real top 5)
  podiumExact: boolean;
  allFive: boolean;
  bonus: number;
}

export interface TipScore {
  men: GenderScore;
  women: GenderScore;
  total: number;
}

/** Score one gender's picks against the actual finishing order. */
export function scoreGender(picks: Picks, actual: string[]): GenderScore {
  const top = actual.slice(0, TIP_SIZE);
  const inTop = new Set(top);

  let exact = 0;
  let partial = 0;
  for (let i = 0; i < TIP_SIZE; i++) {
    const pick = picks[i];
    if (!pick) continue;
    if (top[i] === pick) exact++;
    else if (inTop.has(pick)) partial++;
  }

  const placedExactly = (i: number) => !!picks[i] && picks[i] === top[i];
  const podiumExact = top.length >= 3 && placedExactly(0) && placedExactly(1) && placedExactly(2);
  const allFive = top.length >= TIP_SIZE && [0, 1, 2, 3, 4].every(placedExactly);

  const bonus = (podiumExact ? BONUS_PODIUM : 0) + (allFive ? BONUS_ALL_FIVE : 0);
  const points = exact * PTS_EXACT + partial * PTS_PARTIAL + bonus;
  return { points, exact, partial, podiumExact, allFive, bonus };
}

/** Score a full tip (both genders) against verified results. */
export function scoreTip(tip: Pick<RaceTip, 'men' | 'women'>, result: Pick<RaceResult, 'men' | 'women'>): TipScore {
  const men = scoreGender(tip.men, result.men);
  const women = scoreGender(tip.women, result.women);
  return { men, women, total: men.points + women.points };
}

/** True once the tip window has closed — locked at the race start (no edits after). */
export function isTipLocked(raceDateIso: string, now: number = Date.now()): boolean {
  return now >= +new Date(raceDateIso);
}
