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

  // DATEV Challenge Roth — verified (challenge-roth.com · nordbayern.de): So 05.07.2026, swim start
  // 06:30 (Main-Donau-Kanal), men's winner ~13:53, women's ~14:39 (full distance — not shortened).
  'se-ch-roth': {
    raceId: 'se-ch-roth',
    source: 'challenge-roth.com · NN',
    updated: '2026-06-28',
    hashtag: '#ChallengeRoth',
    presentedBy: 'DATEV',
    sections: [
      {
        title: 'Das Rennen',
        items: [
          { label: 'Schwimmstart', place: 'Main-Donau-Kanal · Hilpoltstein', time: '06:30' },
          { label: 'Sieger (Herren) im Ziel', place: 'Triathlon-Park Roth', time: 'ab 13:53' },
          { label: 'Siegerin (Damen) im Ziel', place: 'Triathlon-Park Roth', time: 'ab 14:39' },
        ],
      },
      {
        title: 'Side-Events',
        items: [
          { label: 'Challenge-forAll · Junior-Challenge', place: 'Roth', time: 'Fr–Sa 03.–04.07.' },
        ],
      },
      {
        title: 'Fan-Zonen',
        items: [
          { label: 'Solarberg', place: 'Der legendäre Anstieg', mapsUrl: maps('Solarberg Challenge Roth Hilpoltstein') },
          { label: 'Zielstadion', place: 'Triathlon-Park Roth', mapsUrl: maps('Triathlon-Park Roth Zielstadion') },
        ],
      },
      {
        title: 'Live verfolgen',
        items: [{ label: 'Livestream · challenge-roth.com', url: 'https://www.challenge-roth.com/' }],
      },
    ],
  },
};

export function getBriefing(raceId?: string): RaceBriefing | undefined {
  return raceId ? raceBriefings[raceId] : undefined;
}
