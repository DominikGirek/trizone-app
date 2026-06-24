// Shared race-identity helpers. Kept in lib/ (not services/races) so both services/races
// and services/athletes can use raceKey without a circular import.

// Generic words that don't identify a specific race — stripped so every naming variant
// collapses to the host city.
const GENERIC = new Set([
  'ironman', 'im', 'challenge', 't100', 'wtcs', 'pto', 'triathlon', 'tri',
  'world', 'european', 'europe', 'championship', 'championships', 'series',
  'pro', 'professional', 'elite', 'men', 'women', 'mixed', 'relay', 'sprint',
  'middle', 'long', 'distance', 'cup', 'open', 'race', 'the', 'of', 'und',
  'am', 'main', 'presented', 'powered', 'by', 'datev', 'mainova', 'sokin',
  'ekoi', 'isuzu', 'intermarche', 'vinfast', 'alga', 'french', 'riviera',
  // country / region descriptors IRONMAN tacks on ("France Nice", "Switzerland Thun")
  'france', 'germany', 'deutschland', 'switzerland', 'schweiz', 'austria',
  'oesterreich', 'italy', 'italia', 'spain', 'espana', 'uk', 'usa',
]);

function cityTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((tk) => tk.length > 2 && !/^\d+$/.test(tk) && !GENERIC.has(tk));
}

/**
 * Stable race identity = race day + host-city token(s). Strips generic descriptors
 * (IRONMAN, European Championship, sponsor prefixes, year, distance) so every naming
 * variant of the same race on the same day collapses to one key:
 *   "Mainova IRONMAN European Championship Frankfurt" @ 2026-06-28 → 2026-06-28-frankfurt
 *   "IRONMAN Frankfurt"                                @ 2026-06-28 → 2026-06-28-frankfurt
 *   "DATEV Challenge Roth"                             @ 2026-07-05 → 2026-07-05-roth
 * Two DIFFERENT races on the same day (e.g. Roth vs Les Sables) get different keys.
 * Returns '' when no city token can be derived (caller should then not link).
 */
export function raceKey(event: string, date: string): string {
  const city = cityTokens(event).sort();
  if (!city.length) return '';
  return `${date.slice(0, 10)}-${city.join('-')}`;
}

/** Date-independent city key (a venue rarely moves year to year) → keys raceVenues. */
export function cityKey(event: string): string {
  return cityTokens(event).sort().join('-');
}
