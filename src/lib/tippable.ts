/**
 * Which races can be tipped. Deliberately small + risk-minimised (decision 2026-06-28): only
 *   • IRONMAN Pro Series races — flagged by the official "/proseries/" start-list URL (this set
 *     already INCLUDES the Kona World Championship), so the allowlist stays in sync with IRONMAN.
 *   • DATEV Challenge Roth (se-ch-roth)
 *   • T100 Triathlon World Tour rounds (series === 'T100')
 * Everything else is NOT tippable for now — we'd rather cover a few marquee races with reliable
 * verified results than many races we can't score honestly. Widen this later as coverage grows.
 */
export function isTippableRace(
  e?: { id?: string; series?: string; proStartListUrl?: string } | null,
): boolean {
  if (!e) return false;
  if (e.series === 'T100') return true;
  if (e.id === 'se-ch-roth') return true;
  return !!e.proStartListUrl && e.proStartListUrl.includes('/proseries/');
}
