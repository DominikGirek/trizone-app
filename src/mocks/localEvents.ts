import { eventStatusFromDate } from '@/lib/format';
import type { LocalEvent } from '@/types';

// Verified real events (dates confirmed against DTU / official sites). Used as
// an offline fallback for the live DTU feed, and as the source of events that
// have a native RACE RESULT live ticker. NEVER fabricate dates or status:
// store the real ISO date and derive status from it via eventStatusFromDate.

const VOLKS = { label: 'Volkstriathlon', swim: 0.5, bike: 20, run: 5 };
const SPRINT = { label: 'Sprint', swim: 0.5, bike: 20, run: 5 };
const KURZ = { label: 'Kurzdistanz', swim: 1.5, bike: 40, run: 10 };
const MITTEL = { label: 'Mitteldistanz', swim: 1.9, bike: 90, run: 21.1 };

interface SeedEvent extends Omit<LocalEvent, 'status'> {}

const seed: SeedEvent[] = [
  {
    // https://www.bonn-triathlon.de  ·  DTU calendar
    id: 'le-bonn',
    name: 'RYZON Bonn Triathlon',
    town: 'Bonn',
    region: 'NRW',
    country: 'DE',
    lat: 50.7374,
    lon: 7.0982,
    date: '2026-06-07T09:15:00',
    distances: [SPRINT, KURZ, MITTEL],
    organizer: 'SSF Bonn',
    websiteUrl: 'https://www.bonn-triathlon.de/',
    provider: 'other',
  },
  {
    // Erlabrunn · raceresult event 363929 (2026) · DTU calendar
    id: 'le-wuerzburg',
    name: 'LIFESTYLE Würzburg Triathlon',
    town: 'Erlabrunn',
    region: 'Bayern',
    country: 'DE',
    lat: 49.8676,
    lon: 9.8862,
    date: '2026-06-14T07:00:00',
    distances: [VOLKS, KURZ, MITTEL],
    organizer: 'J.A. Schweighöfer Veranstaltungs UG',
    websiteUrl: 'https://www.wuerzburg-triathlon.de/',
    provider: 'raceresult',
    raceresultEventId: '363929',
  },
  {
    // https://aasee-triathlon.de · Racepedia (Frielingsdorf Datenservice)
    id: 'le-aasee',
    name: 'Aasee Triathlon Bocholt',
    town: 'Bocholt',
    region: 'NRW',
    country: 'DE',
    lat: 51.838,
    lon: 6.615,
    date: '2026-06-14T08:00:00',
    distances: [VOLKS, SPRINT, { label: 'Bocholter Distanz', swim: 1.5, bike: 40, run: 10 }, MITTEL],
    organizer: 'WSV Bocholt',
    websiteUrl: 'https://aasee-triathlon.de/',
    resultsUrl: 'https://aasee-triathlon-2026.racepedia.de/',
    liveUrl: 'https://aasee-triathlon-2026.racepedia.de/',
    provider: 'racepedia',
  },
  {
    // https://muenster-triathlon.de · DTU / NRW-Verband calendar
    id: 'le-muenster',
    name: 'Sparda Münster City Triathlon',
    town: 'Münster',
    region: 'NRW',
    country: 'DE',
    lat: 51.9607,
    lon: 7.6261,
    date: '2026-06-21T10:00:00',
    distances: [VOLKS, SPRINT, KURZ],
    organizer: 'Tri-Team Münster',
    websiteUrl: 'https://www.muenster-triathlon.de/',
    provider: 'other',
  },
];

export const localEvents: LocalEvent[] = seed.map((e) => ({
  ...e,
  status: eventStatusFromDate(e.date),
}));

export const localEventsById: Record<string, LocalEvent> = Object.fromEntries(
  localEvents.map((e) => [e.id, e]),
);

/** Curated events that expose a native RACE RESULT live ticker. */
export const featuredLocalEvents: LocalEvent[] = localEvents.filter((e) => e.raceresultEventId);
