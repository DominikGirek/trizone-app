import athleteLinksData from '@/data/athleteLinks.json';
import athleteStartsData from '@/data/athleteStarts.json';
import proAthletesData from '@/data/proAthletes.json';
import proStartsMediaData from '@/data/proStartsMedia.json';
import proStartsPtoData from '@/data/proStartsPTO.json';
import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete, AthleteLinks, AthleteStart } from '@/types';

const delay = <T>(value: T, ms = 100) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// Curated, kept in separate JSONs so the data pipeline (Raspberry Pi) can
// regenerate them without touching code. Merged onto athletes on read.
const LINKS = (athleteLinksData as { links: Record<string, AthleteLinks> }).links;
const STARTS = (athleteStartsData as { starts: Record<string, AthleteStart[]> }).starts;

// Pro athletes auto-ingested from real start lists (WTCS via World Triathlon API,
// IRONMAN/70.3/Challenge/T100 via protriathletes.org). Merged on TOP of the curated
// roster — curated ids win, so hand-tuned athletes stay authoritative and new pros
// appear automatically with full profiles.
type ProFile = { athletes?: Athlete[]; starts?: Record<string, AthleteStart[]> };
const PRO_SOURCES = [proAthletesData, proStartsPtoData, proStartsMediaData] as unknown as ProFile[];

// Generated athletes, deduped by id (first source wins; series unioned).
const genById = new Map<string, Athlete>();
for (const src of PRO_SOURCES) {
  for (const a of src.athletes ?? []) {
    const existing = genById.get(a.id);
    if (!existing) genById.set(a.id, { ...a });
    else existing.series = [...new Set([...(existing.series ?? []), ...(a.series ?? [])])];
  }
}
// Generated upcoming starts, concatenated across sources per athlete.
const PRO_STARTS: Record<string, AthleteStart[]> = {};
for (const src of PRO_SOURCES) {
  for (const [id, list] of Object.entries(src.starts ?? {})) {
    PRO_STARTS[id] = [...(PRO_STARTS[id] ?? []), ...list];
  }
}

const generatedPros = [...genById.values()].filter((p) => !athletesById[p.id]);
const allAthletes: Athlete[] = [...athletes, ...generatedPros];
const allById: Record<string, Athlete> = {
  ...Object.fromEntries(generatedPros.map((a) => [a.id, a])),
  ...athletesById, // curated wins on id collision
};

function withLinks(athlete: Athlete): Athlete {
  const links = LINKS[athlete.id];
  // Merge hand-curated + all generated starts, deduped by event (curated wins).
  const hand = STARTS[athlete.id] ?? [];
  const gen = PRO_STARTS[athlete.id] ?? [];
  let starts: AthleteStart[] | undefined;
  if (hand.length || gen.length) {
    const byEvent = new Map<string, AthleteStart>();
    for (const s of [...hand, ...gen]) if (!byEvent.has(s.event)) byEvent.set(s.event, s);
    starts = [...byEvent.values()];
  }
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
