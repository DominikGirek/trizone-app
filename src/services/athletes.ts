import athleteBlocklistData from '@/data/athleteBlocklist.json';
import athleteLinksData from '@/data/athleteLinks.json';
import athleteStartsData from '@/data/athleteStarts.json';
import proAthletesData from '@/data/proAthletes.json';
import proStartsIronmanData from '@/data/proStartsIronman.json';
import proStartsLlmData from '@/data/proStartsLLM.json';
import proStartsMediaData from '@/data/proStartsMedia.json';
import proStartsMikaData from '@/data/proStartsMika.json';
import proStartsPtoData from '@/data/proStartsPTO.json';
import sourcesData from '@/data/sources.json';
import { fetchWithTimeout } from '@/lib/fetchTimeout';
import { raceKey } from '@/lib/raceKey';
import { athletes, athletesById } from '@/mocks/athletes';
import { fetchWtAthlete } from '@/services/worldTriathlon';
import type { Athlete, AthleteLinks, AthleteStart } from '@/types';

type ProFile = { athletes?: Athlete[]; starts?: Record<string, AthleteStart[]> };
type LinksFile = { links: Record<string, AthleteLinks> };
type StartsFile = { starts: Record<string, AthleteStart[]> };
type SourcesFile = { enabled?: Record<string, boolean> };
type BlockFile = { blocked?: string[] };
type KeyedSource = { key: string; data: ProFile };

// The robots commit fresh data to GitHub; the app fetches those hosted files at runtime
// so new pro start lists reach already-installed apps WITHOUT a pull or rebuild. Each
// fetch falls back to the bundled snapshot when offline or on error. Override the host
// with EXPO_PUBLIC_DATA_URL (e.g. a CDN); defaults to the repo's raw main branch.
const DATA_BASE =
  process.env.EXPO_PUBLIC_DATA_URL ||
  'https://raw.githubusercontent.com/DominikGirek/trizone-app/main/src/data';

async function fetchJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const res = await fetchWithTimeout(`${DATA_BASE}/${file}`, {}, 8000);
    if (!res.ok) throw new Error(`${file} ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback; // bundled snapshot
  }
}

interface Merged {
  allAthletes: Athlete[];
  allById: Record<string, Athlete>;
  LINKS: Record<string, AthleteLinks>;
  STARTS: Record<string, AthleteStart[]>;
  PRO_STARTS: Record<string, AthleteStart[]>;
}

function build(
  links: LinksFile,
  hand: StartsFile,
  proSources: KeyedSource[],
  enabled: Record<string, boolean>,
  blocked: Set<string>,
): Merged {
  // Per-source kill-switch: a source flagged false (sources.json) is dropped entirely.
  const active = proSources.filter((s) => enabled[s.key] !== false).map((s) => s.data);
  // Generated athletes, deduped by id (first source wins; series unioned).
  const genById = new Map<string, Athlete>();
  for (const src of active) {
    for (const a of src.athletes ?? []) {
      const existing = genById.get(a.id);
      if (!existing) genById.set(a.id, { ...a });
      else {
        existing.series = [...new Set([...(existing.series ?? []), ...(a.series ?? [])])];
        // PTO athletes carry no gender/country — let a later source fill the gaps so the
        // athlete lands in the right Pro Women / Pro Men table.
        if (!existing.gender && a.gender) existing.gender = a.gender;
        if (!existing.country && a.country) existing.country = a.country;
      }
    }
  }
  // Generated upcoming starts, concatenated across sources per athlete.
  const PRO_STARTS: Record<string, AthleteStart[]> = {};
  for (const src of active) {
    for (const [id, list] of Object.entries(src.starts ?? {})) {
      if (blocked.has(id)) continue;
      PRO_STARTS[id] = [...(PRO_STARTS[id] ?? []), ...list];
    }
  }
  // Takedown: blocked ids vanish from profiles + every start list.
  const generatedPros = [...genById.values()].filter((p) => !athletesById[p.id] && !blocked.has(p.id));
  const curated = Object.fromEntries(Object.entries(athletesById).filter(([id]) => !blocked.has(id)));
  return {
    allAthletes: [...athletes.filter((a) => !blocked.has(a.id)), ...generatedPros],
    allById: { ...Object.fromEntries(generatedPros.map((a) => [a.id, a])), ...curated },
    LINKS: links.links,
    STARTS: hand.starts,
    PRO_STARTS,
  };
}

// Ordered pro sources with their kill-switch keys (priority = array order).
const keyed = (
  pro: ProFile, pto: ProFile, ironman: ProFile, mika: ProFile, media: ProFile, llm: ProFile,
): KeyedSource[] => [
  { key: 'wtcs', data: pro },
  { key: 'pto', data: pto },
  { key: 'ironman', data: ironman },
  { key: 'mika', data: mika },
  { key: 'media', data: media },
  { key: 'llm', data: llm },
];

// Instant bundled snapshot (used until the hosted data arrives, and as offline fallback).
const bundled = build(
  athleteLinksData as LinksFile,
  athleteStartsData as StartsFile,
  keyed(proAthletesData as unknown as ProFile, proStartsPtoData as unknown as ProFile, proStartsIronmanData as unknown as ProFile, proStartsMikaData as unknown as ProFile, proStartsMediaData as unknown as ProFile, proStartsLlmData as unknown as ProFile),
  (sourcesData as SourcesFile).enabled ?? {},
  new Set((athleteBlocklistData as BlockFile).blocked ?? []),
);

// Cached merge of the HOSTED data (refreshed in the background).
let cache: { at: number; data: Merged } | null = null;
let refreshing = false;
const TTL = 60 * 60 * 1000;

async function refreshMerged(): Promise<void> {
  const [links, hand, pro, ptoStarts, ironmanStarts, mikaStarts, mediaStarts, llmStarts, sources, block] = await Promise.all([
    fetchJson('athleteLinks.json', athleteLinksData as unknown as LinksFile),
    fetchJson('athleteStarts.json', athleteStartsData as unknown as StartsFile),
    fetchJson('proAthletes.json', proAthletesData as unknown as ProFile),
    fetchJson('proStartsPTO.json', proStartsPtoData as unknown as ProFile),
    fetchJson('proStartsIronman.json', proStartsIronmanData as unknown as ProFile),
    fetchJson('proStartsMika.json', proStartsMikaData as unknown as ProFile),
    fetchJson('proStartsMedia.json', proStartsMediaData as unknown as ProFile),
    fetchJson('proStartsLLM.json', proStartsLlmData as unknown as ProFile),
    fetchJson('sources.json', sourcesData as SourcesFile),
    fetchJson('athleteBlocklist.json', athleteBlocklistData as BlockFile),
  ]);
  cache = {
    at: Date.now(),
    data: build(
      links, hand,
      keyed(pro, ptoStarts, ironmanStarts, mikaStarts, mediaStarts, llmStarts),
      sources.enabled ?? {},
      new Set(block.blocked ?? []),
    ),
  };
}

function refreshMergedInBackground(): void {
  if (refreshing) return;
  refreshing = true;
  refreshMerged()
    .catch(() => {})
    .finally(() => {
      refreshing = false;
    });
}

/**
 * Merged athlete data, INSTANT and never blocking the hot path: the cached hosted data if fresh,
 * otherwise the bundled snapshot. The hosted refresh (10 network fetches) runs only in the background —
 * it used to be awaited here and froze the cold start for ~10s when raw.githubusercontent throttled.
 */
function getMerged(): Merged {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  refreshMergedInBackground();
  return cache?.data ?? bundled;
}

function withLinks(athlete: Athlete, m: Merged): Athlete {
  const links = m.LINKS[athlete.id];
  // Merge hand-curated + all generated starts, deduped by DATE — an athlete can't start
  // two races on the same day, so same date = same race (handles different event names
  // across sources). Priority: hand-curated, then WTCS, PTO, media, LLM.
  const hand = m.STARTS[athlete.id] ?? [];
  const gen = m.PRO_STARTS[athlete.id] ?? [];
  let starts: AthleteStart[] | undefined;
  if (hand.length || gen.length) {
    // Dedup by raceKey (day + host city), NOT just date: that collapses naming variants
    // of the SAME race ("IRONMAN Frankfurt" == "Mainova … Frankfurt") while keeping two
    // DIFFERENT races on the same day (e.g. Roth vs Les Sables) as separate starts.
    const byRace = new Map<string, AthleteStart>();
    for (const s of [...hand, ...gen]) {
      const key = raceKey(s.event, s.date) || s.date;
      if (!byRace.has(key)) byRace.set(key, s);
    }
    starts = [...byRace.values()];
  }
  if (!links && !starts) return athlete;
  return {
    ...athlete,
    links: links ? { ...athlete.links, ...links } : athlete.links,
    upcomingStarts: starts ?? athlete.upcomingStarts,
  };
}

export async function getAthletes(): Promise<Athlete[]> {
  const m = getMerged();
  return m.allAthletes.map((a) => withLinks(a, m));
}

export async function getAthleteById(id: string): Promise<Athlete | undefined> {
  // App ids are name slugs (e.g. "patrick-lange"); real World Triathlon ids are numeric.
  const m = getMerged();
  if (m.allById[id]) return withLinks(m.allById[id], m);
  try {
    return await fetchWtAthlete(id);
  } catch {
    return undefined;
  }
}

export async function getAthletesByIds(ids: string[]): Promise<Athlete[]> {
  const m = getMerged();
  return ids
    .map((id) => m.allById[id])
    .filter(Boolean)
    .map((a) => withLinks(a as Athlete, m));
}

/** Synchronous bundled snapshot — for placeholderData so lists render instantly. */
export function bundledAthletes(): Athlete[] {
  return bundled.allAthletes.map((a) => withLinks(a, bundled));
}
