import type { RaceBriefing } from '@/types';

const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/**
 * Curated race-day "Fan-Guides" → the Race Center "Briefing" tab. Flagship races only, and ONLY
 * from verified sources. Volatile race-day figures (start/finish/cutoff, distances) carry a dated
 * source line and may change — we never fabricate. Keyed by the race/event id.
 *
 * Frankfurt 2026 verified (28.06.2026): heat-shortened to 3.8/125/21 km, schedule moved earlier —
 * winner ~11:15, cutoff 18:30 (tri-mag.de; the old 14:00/22:00 fan-guide is stale). Swim Langener
 * Waldsee, finish Römerberg. Broadcast HR/hessenschau/ARD + IRONMAN YouTube from 06:10.
 */
export const raceBriefings: Record<string, RaceBriefing> = {
  'se-im-frankfurt': {
    raceId: 'se-im-frankfurt',
    note: 'Wegen Hitze verkürzt: 3,8 / 125 / 21 km',
    source: 'tri-mag · IRONMAN',
    updated: '2026-06-28',
    hashtag: '#IMFrankfurt',
    presentedBy: 'Mainova',
    sections: [
      {
        title: 'Das Rennen',
        items: [
          { label: 'Start', place: 'Langener Waldsee', time: '06:20' },
          { label: 'Sieger im Ziel', place: 'Frankfurter Römerberg', time: '~11:15' },
          { label: 'Zielschluss', place: 'Frankfurter Römerberg', time: '18:30' },
        ],
      },
      {
        title: 'Side-Events',
        items: [
          { label: 'Helaba NightRun', place: 'Mainufer am Römer', time: 'Do 19:00' },
          { label: 'IRONMAN Shake-Out-Run', place: 'Eventstage Mainkai', time: 'Fr 09:00' },
          { label: 'Pro-Athletes-Panel', place: 'ASTOR Film Lounge MyZeil', time: 'Fr 10:30' },
          { label: 'Mainova IRONMAN Race Night', place: 'Massif Central', time: 'Fr 17:00' },
        ],
      },
      {
        title: 'Fan-Zonen',
        items: [
          { label: 'Heartbreak Hill', place: 'Bad Vilbel', mapsUrl: maps('Heartbreak Hill Bad Vilbel Ironman') },
          { label: 'Mainova Energy Zone', place: 'Frankfurt Mainufer', mapsUrl: maps('Mainufer Frankfurt') },
        ],
      },
      {
        title: 'Live verfolgen',
        items: [
          {
            label: 'HR · hessenschau · ARD',
            time: 'ab 06:10',
            url: 'https://www.hessenschau.de/sport/mehr-sport/ironman-frankfurt/live-ironman-100.html',
          },
          { label: 'IRONMAN YouTube', time: 'ab 06:10', url: 'https://www.youtube.com/@ironmantriathlon' },
        ],
      },
    ],
  },
};

export function getBriefing(raceId?: string): RaceBriefing | undefined {
  return raceId ? raceBriefings[raceId] : undefined;
}
