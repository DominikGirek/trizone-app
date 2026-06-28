import type { Coords } from '@/hooks/use-location';
import { distanceKm } from '@/lib/format';
import { isTippableRace } from '@/lib/tippable';
import { isTipLocked } from '@/lib/tippspiel';
import { seriesEvents } from '@/mocks/seriesEvents';
import { getLocalEvents, type LocalEventWithDistance } from '@/services/localEvents';
import { getPastEvents } from '@/services/pastEvents';
import { getRaces } from '@/services/races';
import type { LocalEvent, Race } from '@/types';

/**
 * Unified event feed in one list so the user never thinks "pro vs local":
 *  - pro:    World Triathlon (WTCS …)
 *  - local:  DTU grassroots calendar
 *  - series: big mass-participation series (IRONMAN, Challenge, T100)
 * Tapping routes to the right detail screen; the UI filters this feed.
 */
export type FeedItem =
  | { kind: 'pro'; id: string; date: string; status: Race['status']; race: Race }
  | { kind: 'local'; id: string; date: string; status: LocalEvent['status']; event: LocalEventWithDistance }
  | { kind: 'series'; id: string; date: string; status: LocalEvent['status']; event: LocalEventWithDistance };

export async function getAllEvents(coords?: Coords | null): Promise<FeedItem[]> {
  const [races, locals, past] = await Promise.all([getRaces(), getLocalEvents(coords), getPastEvents()]);

  const withDist = (e: LocalEvent): LocalEventWithDistance => ({
    ...e,
    distanceKm: coords ? distanceKm(coords.lat, coords.lon, e.lat, e.lon) : undefined,
  });

  const items: FeedItem[] = [
    ...races.map((r): FeedItem => ({ kind: 'pro', id: r.id, date: r.date, status: r.status, race: r })),
    ...locals.map((e): FeedItem => ({ kind: 'local', id: e.id, date: e.date, status: e.status, event: e })),
    ...seriesEvents.map((e): FeedItem => ({
      kind: 'series',
      id: e.id,
      date: e.date,
      status: e.status,
      event: withDist(e),
    })),
  ];

  // Merge past local events from the history index (last 12 months), de-duped
  // against the live feed by id and by name+day (recurring events keep one per day).
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, '');
  const liveIds = new Set(items.map((i) => i.id));
  const liveKeys = new Set(
    items.map((i) => `${norm(i.kind === 'pro' ? i.race.name : i.event.name)}|${i.date.slice(0, 10)}`),
  );
  for (const e of past) {
    if (liveIds.has(e.id) || liveKeys.has(`${norm(e.name)}|${e.date.slice(0, 10)}`)) continue;
    items.push({ kind: 'local', id: e.id, date: e.date, status: e.status, event: withDist(e) });
  }

  // Live first, then upcoming by date, finished last.
  const rank = (s: Race['status']) => (s === 'live' ? 0 : s === 'finished' ? 2 : 1);
  items.sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    return +new Date(a.date) - +new Date(b.date);
  });
  return items;
}

/**
 * The Tippspiel discovery funnel: tippable races (IM Pro Series · Roth · T100 · Kona) that are still
 * OPEN to tip (not yet locked at the start), soonest first. Drives the "Offene Tipprunden" list + the
 * dashboard card so users find what to predict instead of hunting through the calendar.
 */
export function openTippableRaces(
  events: FeedItem[],
  now = Date.now(),
): Extract<FeedItem, { kind: 'series' | 'local' }>[] {
  return events
    .filter((i): i is Extract<FeedItem, { kind: 'series' | 'local' }> => i.kind !== 'pro')
    .filter((i) => isTippableRace(i.event) && !isTipLocked(i.date, now))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}
