import { races as mockRaces, racesById as mockRacesById } from '@/mocks/events';
import { resultsByRace } from '@/mocks/results';
import { fetchWtcsEvents } from '@/services/worldTriathlon';
import type { Race, RaceResult } from '@/types';

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
