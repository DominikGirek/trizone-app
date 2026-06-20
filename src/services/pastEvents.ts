import indexData from '@/data/eventIndex.json';
import type { LocalEvent } from '@/types';

/**
 * Past local events (last 12 months) from the generated event-history index
 * (see scripts/ingest-events.mjs). The DTU list is forward-only, so this index
 * is how the "Vergangene" tab gets real grassroots triathlons. Tapping one opens
 * /local/[id], which re-fetches the live detail (incl. results ticker).
 *
 * The bundled snapshot ships with the app; if EXPO_PUBLIC_EVENT_INDEX_URL is set
 * (a hosted, daily-refreshed index) we prefer that for freshness without a release.
 */
type IndexEvent = Omit<LocalEvent, 'status'> & { slug?: string };
interface EventIndex {
  generatedAt: string;
  events: IndexEvent[];
  editions?: Record<string, { year: number; date: string; resultsUrl: string; provider: string }[]>;
}

const INDEX_URL = process.env.EXPO_PUBLIC_EVENT_INDEX_URL;

function statusFor(iso: string): LocalEvent['status'] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  if (day < now) return 'finished';
  if (+day === +now) return 'live';
  return 'upcoming';
}

/** Map index stubs → LocalEvent, fresh status, de-duped per name+day (one edition per day). */
function toLocalEvents(idx: EventIndex): LocalEvent[] {
  const seen = new Set<string>();
  const out: LocalEvent[] = [];
  for (const e of idx.events ?? []) {
    const key = `${e.slug ?? e.name.toLowerCase()}|${e.date.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { slug, ...rest } = e;
    void slug;
    out.push({ ...rest, status: statusFor(e.date) });
  }
  return out;
}

let cache: LocalEvent[] | null = null;

export async function getPastEvents(): Promise<LocalEvent[]> {
  if (cache) return cache;
  if (INDEX_URL) {
    try {
      const res = await fetch(INDEX_URL);
      if (res.ok) {
        cache = toLocalEvents((await res.json()) as EventIndex);
        return cache;
      }
    } catch {
      // fall through to the bundled snapshot
    }
  }
  cache = toLocalEvents(indexData as unknown as EventIndex);
  return cache;
}
