import raceVenuesData from '@/data/raceVenues.json';
import { races as mockRaces, racesById as mockRacesById } from '@/mocks/events';
import { resultsByRace } from '@/mocks/results';
import { getAthletes } from '@/services/athletes';
import { fetchWtcsEvents } from '@/services/worldTriathlon';
import type { Athlete, AthleteStart, Race, RaceResult, SeriesId } from '@/types';

const delay = <T>(value: T, ms = 80) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Memoized real-events loader with graceful fallback to mock data.
let cache: { at: number; races: Race[] } | null = null;
const TTL = 10 * 60 * 1000;

async function loadRaces(): Promise<Race[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.races;
  try {
    const real = await fetchWtcsEvents();
    if (real.length) {
      cache = { at: Date.now(), races: real };
      return real;
    }
  } catch {
    // network/auth issue → fall through to mocks
  }
  return [...mockRaces].sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

export async function getRaces(): Promise<Race[]> {
  return loadRaces();
}

export async function getRaceById(id: string): Promise<Race | undefined> {
  const list = await loadRaces();
  return list.find((r) => r.id === id) ?? mockRacesById[id];
}

/** The next upcoming (or live) race, used for the calendar countdown hero. */
export async function getNextRace(): Promise<Race | undefined> {
  const now = Date.now();
  const list = await loadRaces();
  return [...list]
    .filter((r) => +new Date(r.date) >= now || r.status !== 'finished')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
}

// --- Results: surfaced inside event/athlete detail (sample until WT results wired) ---

export function getResults(raceId: string): Promise<RaceResult[]> {
  return delay(resultsByRace[raceId] ?? []);
}

/** Race ids (most recent first) where the given athlete has a result. */
export function getAthleteResults(
  athleteId: string,
): Promise<{ race: Race; result: RaceResult }[]> {
  const rows: { race: Race; result: RaceResult }[] = [];
  for (const [raceId, results] of Object.entries(resultsByRace)) {
    const result = results.find((r) => r.athleteId === athleteId);
    if (result && mockRacesById[raceId]) rows.push({ race: mockRacesById[raceId], result });
  }
  rows.sort((a, b) => +new Date(b.race.date) - +new Date(a.race.date));
  return delay(rows);
}

// --- Per-race PRO start list (aggregated from the athletes' upcoming starts) -----
// Inverts "athlete → his starts" into "race → its athletes". Data comes from the
// pipeline robots (official + media + LLM).

// Generic words that don't identify a specific race — stripped so every naming
// variant collapses. The discriminating token is the host city.
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

export interface StartPoint {
  lat: number;
  lon: number;
  label?: string;
}
const VENUES = (raceVenuesData as { venues: Record<string, StartPoint & { source?: string }> }).venues;
// Refresh venues from the hosted file (the venue robot commits there) so new/updated
// swim-start pins reach the app WITHOUT a rebuild. Fire-and-forget; bundled is the
// instant fallback and stays if the fetch fails. Override host with EXPO_PUBLIC_DATA_URL.
const DATA_BASE =
  process.env.EXPO_PUBLIC_DATA_URL ||
  'https://raw.githubusercontent.com/DominikGirek/trizone-app/main/src/data';
fetch(`${DATA_BASE}/raceVenues.json`)
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => { if (j?.venues) Object.assign(VENUES, j.venues); })
  .catch(() => {});

/**
 * Best map target for an event: the verified SWIM-START coordinates if we have them
 * (raceVenues.json, geocoded from the real venue, never the organizer), otherwise null
 * so the caller can fall back to a name search. Town centroids are NOT returned here —
 * the caller already has those.
 */
export function startPointFor(event: string): StartPoint | null {
  const v = VENUES[cityKey(event)];
  return v ? { lat: v.lat, lon: v.lon, label: v.label } : null;
}

/** Friendly source name from a start's URL (shown per athlete). */
export function sourceLabel(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    const map: Record<string, string> = {
      'protriathletes.org': 'PTO',
      'stats.protriathletes.org': 'PTO',
      'triathlon.org': 'World Triathlon',
      'ironman.com': 'ironman.com',
    };
    return map[h] || h;
  } catch {
    return undefined;
  }
}

export interface StartListEntry {
  athlete: Athlete;
  start: AthleteStart;
}
export interface RaceStartList {
  key: string;
  name: string;
  date: string;
  series?: SeriesId;
  location?: string;
  entries: StartListEntry[];
}

/** All athletes we believe are starting the race identified by `key`. */
export async function getRaceStartList(key: string, now = Date.now()): Promise<RaceStartList | null> {
  const athletes = await getAthletes();
  const entries: StartListEntry[] = [];
  for (const a of athletes) {
    for (const s of a.upcomingStarts ?? []) {
      if (raceKey(s.event, s.date) === key && +new Date(s.date) >= now - 86400000) entries.push({ athlete: a, start: s });
    }
  }
  if (!entries.length) return null;
  entries.sort((x, y) => x.athlete.name.localeCompare(y.athlete.name));
  const longest = entries.map((e) => e.start).sort((a, b) => b.event.length - a.event.length)[0];
  const name = longest.event.replace(/\s*\([^)]*\)/g, '').trim(); // drop "(Titelverteidigung)" etc.
  return { key, name, date: longest.date, series: longest.series, location: longest.location, entries };
}
