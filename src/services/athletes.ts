import athleteLinksData from '@/data/athleteLinks.json';
import athleteStartsData from '@/data/athleteStarts.json';
import proAthletesData from '@/data/proAthletes.json';
import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete, AthleteLinks, AthleteStart } from '@/types';

const delay = <T>(value: T, ms = 100) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Curated, kept in separate JSONs so the data pipeline (Raspberry Pi) can
// regenerate them without touching code. Merged onto athletes on read.
const LINKS = (athleteLinksData as { links: Record<string, AthleteLinks> }).links;
const STARTS = (athleteStartsData as { starts: Record<string, AthleteStart[]> }).starts;

// Pro athletes auto-ingested from real start lists (WTCS via World Triathlon, …).
// Merged on TOP of the curated roster — curated ids win, so hand-tuned athletes
// stay authoritative and new pros appear automatically with full profiles.
const PRO = (proAthletesData as { athletes: Athlete[] }).athletes as unknown as Athlete[];
const PRO_STARTS = ((proAthletesData as { starts?: Record<string, AthleteStart[]> }).starts) ?? {};
const generatedPros = PRO.filter((p) => !athletesById[p.id]);
const allAthletes: Athlete[] = [...athletes, ...generatedPros];
const allById: Record<string, Athlete> = {
  ...Object.fromEntries(generatedPros.map((a) => [a.id, a])),
  ...athletesById, // curated wins on id collision
};

function withLinks(athlete: Athlete): Athlete {
  const links = LINKS[athlete.id];
  const starts = STARTS[athlete.id] ?? PRO_STARTS[athlete.id];
  if (!links && !starts) return athlete;
  return {
    ...athlete,
    links: links ? { ...athlete.links, ...links } : athlete.links,
    upcomingStarts: starts ?? athlete.upcomingStarts,
  };
}

export function getAthletes(): Promise<Athlete[]> {
  return delay(allAthletes.map(withLinks));
}

export async function getAthleteById(id: string): Promise<Athlete | undefined> {
  // App ids are name slugs (e.g. "patrick-lange"); real World Triathlon ids are numeric.
  if (allById[id]) return withLinks(allById[id]);
  try {
    return await fetchWtAthlete(id);
  } catch {
    return undefined;
  }
}

export function getAthletesByIds(ids: string[]): Promise<Athlete[]> {
  return delay(
    ids
      .map((id) => allById[id])
      .filter(Boolean)
      .map((a) => withLinks(a as Athlete)),
  );
}
