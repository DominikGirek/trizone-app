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
// Inverts "athlete → his starts" into "race → its athletes". Race identity is a
// normalised key so naming variants of the same race collapse, e.g. "DATEV Challenge
// Roth" == "Challenge Roth", "Mainova IRONMAN Frankfurt European Championship" ==
// "IRONMAN Frankfurt". Data comes from the pipeline robots (official + media + LLM).
const SPONSORS = /\b(datev|mainova|sokin|eko[iï]|isuzu|intermarch[ée]|vinfast)\b/gi;
export function raceKey(event: string): string {
  // Tokens are sorted so word-order variants of the same race collapse, e.g.
  // "Vancouver T100" == "T100 Vancouver", "IRONMAN 70.3 Nice" == "Nice IRONMAN 70.3".
  return event
    .toLowerCase()
    .replace(SPONSORS, '')
    .replace(/\([^)]*\)/g, '') // drop "(Debüt)" / "(Titelverteidigung)"
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .sort()
    .join('-');
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

export interface StartListIndexEntry {
  key: string;
  name: string;
  date: string;
  series?: SeriesId;
  count: number;
}

/** Upcoming races we have a pro start list for (for the Events-tab entry point). */
export async function getStartListIndex(now = Date.now()): Promise<StartListIndexEntry[]> {
  const athletes = await getAthletes();
  const map = new Map<string, StartListIndexEntry & { _longest: string }>();
  for (const a of athletes) {
    for (const s of a.upcomingStarts ?? []) {
      if (+new Date(s.date) < now - 86400000) continue;
      const key = raceKey(s.event);
      const e = map.get(key);
      if (!e) {
        map.set(key, { key, name: s.event.replace(/\s*\([^)]*\)/g, '').trim(), date: s.date, series: s.series, count: 1, _longest: s.event });
      } else {
        e.count++;
        if (s.event.length > e._longest.length) {
          e._longest = s.event;
          e.name = s.event.replace(/\s*\([^)]*\)/g, '').trim();
        }
      }
    }
  }
  return [...map.values()]
    .map(({ _longest, ...e }) => e)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** All athletes we believe are starting the race identified by `key`. */
export async function getRaceStartList(key: string, now = Date.now()): Promise<RaceStartList | undefined> {
  const athletes = await getAthletes();
  const entries: StartListEntry[] = [];
  for (const a of athletes) {
    for (const s of a.upcomingStarts ?? []) {
      if (raceKey(s.event) === key && +new Date(s.date) >= now - 86400000) entries.push({ athlete: a, start: s });
    }
  }
  if (!entries.length) return undefined;
  entries.sort((x, y) => x.athlete.name.localeCompare(y.athlete.name));
  const longest = entries.map((e) => e.start).sort((a, b) => b.event.length - a.event.length)[0];
  const name = longest.event.replace(/\s*\([^)]*\)/g, '').trim(); // drop "(Titelverteidigung)" etc.
  return { key, name, date: longest.date, series: longest.series, location: longest.location, entries };
}
