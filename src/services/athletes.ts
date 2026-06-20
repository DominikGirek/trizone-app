import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete } from '@/types';

const delay = <T>(value: T, ms = 100) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export function getAthletes(): Promise<Athlete[]> {
  return delay(athletes);
}

export async function getAthleteById(id: string): Promise<Athlete | undefined> {
  // Mock athletes use ids like "a1"; real World Triathlon ids are numeric.
  if (athletesById[id]) return athletesById[id];
  try {
    return await fetchWtAthlete(id);
  } catch {
    return undefined;
  }
}

export function getAthletesByIds(ids: string[]): Promise<Athlete[]> {
  return delay(ids.map((id) => athletesById[id]).filter(Boolean) as Athlete[]);
}
