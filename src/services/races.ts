import raceVenuesData from '@/data/raceVenues.json';
import { getTippableField } from '@/data/tippableFields';
import { races as mockRaces, racesById as mockRacesById } from '@/mocks/events';
import { resultsByRace } from '@/mocks/results';
import { getAthletes, getAthletesByIds } from '@/services/athletes';
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

// raceKey/cityKey live in lib/raceKey (shared with services/athletes, no import cycle).
import { raceKey, cityKey } from '@/lib/raceKey';
export { raceKey, cityKey };

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

/** The set of raceKeys that currently have a start list (≥1 athlete starting). Cheap funnel check. */
export async function getStartListKeys(now = Date.now()): Promise<string[]> {
  const athletes = await getAthletes();
  const keys = new Set<string>();
  for (const a of athletes) {
    for (const s of a.upcomingStarts ?? []) {
      if (+new Date(s.date) >= now - 86400000) keys.add(raceKey(s.event, s.date));
    }
  }
  return [...keys];
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

/**
 * The pool to tip from: the LIVE start list (athletes' upcoming starts) if we have one, otherwise a
 * curated field (src/data/tippableFields). Gender is taken from the field side an athlete is listed on,
 * so grouping is right even if a roster gender is missing. Null = nothing to tip yet ("Startliste folgt").
 */
export async function getRaceEntries(raceId: string, name: string, date: string): Promise<StartListEntry[] | null> {
  const live = await getRaceStartList(raceKey(name, date));
  if (live?.entries.length) return live.entries;

  const field = getTippableField(raceId);
  if (!field) return null;
  const athletes = await getAthletesByIds([...field.men, ...field.women]);
  const byId = new Map(athletes.map((a) => [a.id, a] as const));
  const mk = (id: string, gender: 'men' | 'women'): StartListEntry | null => {
    const a = byId.get(id);
    return a ? { athlete: { ...a, gender }, start: { date, event: name, confidence: 'confirmed' } } : null;
  };
  const entries = [...field.men.map((id) => mk(id, 'men')), ...field.women.map((id) => mk(id, 'women'))].filter(
    (e): e is StartListEntry => !!e,
  );
  return entries.length ? entries : null;
}
