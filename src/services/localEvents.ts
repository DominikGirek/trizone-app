import { Platform } from 'react-native';

import type { Coords } from '@/hooks/use-location';
import { distanceKm } from '@/lib/format';
import {
  featuredLocalEvents,
  localEvents as sampleEvents,
  localEventsById,
} from '@/mocks/localEvents';
import { seriesEventsById } from '@/mocks/seriesEvents';
import { ingestLocalEventDetail, ingestLocalEvents } from '@/services/dtu';
import type { LocalEvent, TimingProvider } from '@/types';

export interface LocalEventWithDistance extends LocalEvent {
  distanceKm?: number;
}

/**
 * Data strategy (mirrors the news pipeline):
 * - Web: same-origin `/api/local-events` route (server-side DTU ingestion).
 * - Native: ingest the DTU calendar directly (no CORS).
 * - On any failure: fall back to the curated sample so the UI never breaks.
 */
let listCache: LocalEvent[] | null = null;

async function loadEvents(): Promise<LocalEvent[]> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch('/api/local-events');
      if (res.ok) {
        const data = (await res.json()) as LocalEvent[];
        if (data?.length) {
          listCache = data;
          return data;
        }
      }
    } else {
      const data = await ingestLocalEvents();
      if (data.length) {
        listCache = data;
        return data;
      }
    }
  } catch {
    // fall through to sample
  }
  return sampleEvents;
}

async function fetchDetail(id: string): Promise<LocalEvent | undefined> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`/api/local-events?id=${encodeURIComponent(id)}`);
      if (res.ok) return ((await res.json()) as LocalEvent) ?? undefined;
    } else {
      return await ingestLocalEventDetail(id);
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function loadEventById(id: string): Promise<LocalEvent | undefined> {
  if (seriesEventsById[id]) return seriesEventsById[id]; // series ids ("se-…")
  if (localEventsById[id]) return localEventsById[id]; // curated sample ids ("le-…")

  if (!listCache) await loadEvents();
  const base = listCache?.find((e) => e.id === id);
  const detail = await fetchDetail(id);

  // Base (list) has reliable name/town/date/geo; detail adds organizer/website.
  // The live-ticker link (resultsUrl/liveUrl/provider) is ONLY ever taken from
  // the event's own detail page, so it always belongs to *this* event — we never
  // guess or hardcode tickers (a wrong ticker is worse than none).
  if (base) {
    return {
      ...base,
      // Detail page geocodes the exact town → use it for weather/map (list uses
      // the region centroid). Fall back to the base centroid if no detail.
      lat: detail?.lat ?? base.lat,
      lon: detail?.lon ?? base.lon,
      organizer: detail?.organizer ?? base.organizer,
      websiteUrl: detail?.websiteUrl ?? base.websiteUrl,
      resultsUrl: detail?.resultsUrl ?? base.resultsUrl,
      liveUrl: detail?.liveUrl ?? base.liveUrl,
      provider: detail?.provider ?? base.provider,
      distances: detail?.distances?.length ? detail.distances : base.distances,
    };
  }
  return detail;
}

/**
 * Local events, sorted by distance when the user's location is known,
 * otherwise chronologically. Finished events sink below upcoming/live ones.
 */
export async function getLocalEvents(coords?: Coords | null): Promise<LocalEventWithDistance[]> {
  const dtu = await loadEvents();
  const addDist = (e: LocalEvent): LocalEventWithDistance => ({
    ...e,
    distanceKm: coords ? distanceKm(coords.lat, coords.lon, e.lat, e.lon) : undefined,
  });

  // Merge curated events that carry a native live ticker, de-duplicating against
  // the real feed by name (prefer the curated one, which has the ticker).
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, '');
  const featuredNorm = new Set(featuredLocalEvents.map((e) => norm(e.name)));
  const merged = [...featuredLocalEvents, ...dtu.filter((e) => !featuredNorm.has(norm(e.name)))];

  // Honest ordering: live first, then upcoming by date/distance, finished last.
  const rank = (s: LocalEvent['status']) => (s === 'live' ? 0 : s === 'finished' ? 2 : 1);
  return merged.map(addDist).sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (coords && a.status !== 'finished') return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    return +new Date(a.date) - +new Date(b.date);
  });
}

export function getLocalEventById(id: string): Promise<LocalEvent | undefined> {
  return loadEventById(id);
}

/** Human label for a timing provider (used on the live/results button). */
export function providerLabel(provider?: TimingProvider): string | undefined {
  switch (provider) {
    case 'raceresult':
      return 'raceresult';
    case 'racepedia':
      return 'Racepedia';
    default:
      return undefined;
  }
}
