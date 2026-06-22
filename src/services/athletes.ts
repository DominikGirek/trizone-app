import athleteLinksData from '@/data/athleteLinks.json';
import athleteStartsData from '@/data/athleteStarts.json';
import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete, AthleteLinks, AthleteStart } from '@/types';

const delay = <T>(value: T, ms = 100) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Curated, kept in separate JSONs so the data pipeline (Raspberry Pi) can
// regenerate them without touching code. Merged onto athletes on read.
const LINKS = (athleteLinksData as { links: Record<string, AthleteLinks> }).links;
const STARTS = (athleteStartsData as { starts: Record<string, AthleteStart[]> }).starts;

function withLinks(athlete: Athlete): Athlete {
  const links = LINKS[athlete.id];
  const starts = STARTS[athlete.id];
  if (!links && !starts) return athlete;
  return {
    ...athlete,
    links: links ? { ...athlete.links, ...links } : athlete.links,
    upcomingStarts: starts ?? athlete.upcomingStarts,
  };
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
