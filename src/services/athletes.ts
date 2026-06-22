import athleteLinksData from '@/data/athleteLinks.json';
import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete, AthleteLinks } from '@/types';

const delay = <T>(value: T, ms = 100) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Curated official presences, kept in a separate JSON so the data pipeline
// (Raspberry Pi) can regenerate it without touching code. Merged onto athletes.
const LINKS = (athleteLinksData as { links: Record<string, AthleteLinks> }).links;

function withLinks(athlete: Athlete): Athlete {
  const extra = LINKS[athlete.id];
  if (!extra) return athlete;
  return { ...athlete, links: { ...athlete.links, ...extra } };
}

export function getAthletes(): Promise<Athlete[]> {
  return delay(athletes.map(withLinks));
}

export async function getAthleteById(id: string): Promise<Athlete | undefined> {
  // Mock athletes use ids like "patrick-lange"; real World Triathlon ids are numeric.
  if (athletesById[id]) return withLinks(athletesById[id]);
  try {
    return await fetchWtAthlete(id);
  } catch {
    return undefined;
  }
}

export function getAthletesByIds(ids: string[]): Promise<Athlete[]> {
  return delay(
    ids
      .map((id) => athletesById[id])
      .filter(Boolean)
      .map((a) => withLinks(a as Athlete)),
  );
}
