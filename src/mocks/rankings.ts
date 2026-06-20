import type { RankingTable, SeriesId } from '@/types';

const SEASON = '2026';

// Sample season standings, keyed by series then gender.
export const rankings: RankingTable[] = [
  {
    series: 'wtcs',
    gender: 'men',
    season: SEASON,
    entries: [
      { rank: 1, athleteId: 'a3', athleteName: 'Oliver Hayes', country: 'GB', points: 3420, movement: 0 },
      { rank: 2, athleteId: 'a1', athleteName: 'Lukas Brenner', country: 'DE', points: 3275, movement: 1 },
      { rank: 3, athleteId: 'a2', athleteName: 'Mateo Rinaldi', country: 'IT', points: 3110, movement: -1 },
      { rank: 4, athleteId: 'a4', athleteName: 'Tomás Vidal', country: 'ES', points: 2880, movement: 2 },
    ],
  },
  {
    series: 'wtcs',
    gender: 'women',
    season: SEASON,
    entries: [
      { rank: 1, athleteId: 'a5', athleteName: 'Hannah Vogt', country: 'DE', points: 3510, movement: 1 },
      { rank: 2, athleteId: 'a8', athleteName: 'Mia Donato', country: 'AU', points: 3380, movement: -1 },
      { rank: 3, athleteId: 'a6', athleteName: 'Sophie Laurent', country: 'FR', points: 3190, movement: 0 },
      { rank: 4, athleteId: 'a7', athleteName: 'Emma Carlsson', country: 'SE', points: 2950, movement: 3 },
    ],
  },
  {
    series: 'pto',
    gender: 'men',
    season: SEASON,
    entries: [
      { rank: 1, athleteId: 'a9', athleteName: 'Jens Holm', country: 'NO', points: 18540, movement: 0 },
      { rank: 2, athleteId: 'a10', athleteName: 'Rafael Costa', country: 'BR', points: 16980, movement: 1 },
      { rank: 3, athleteId: 'a4', athleteName: 'Tomás Vidal', country: 'ES', points: 15220, movement: -1 },
    ],
  },
  {
    series: 'pto',
    gender: 'women',
    season: SEASON,
    entries: [
      { rank: 1, athleteId: 'a11', athleteName: 'Nora Fischer', country: 'CH', points: 17890, movement: 2 },
      { rank: 2, athleteId: 'a8', athleteName: 'Mia Donato', country: 'AU', points: 17110, movement: -1 },
      { rank: 3, athleteId: 'a12', athleteName: 'Yuki Tanaka', country: 'JP', points: 15640, movement: 1 },
    ],
  },
];

/** Series that have ranking tables, in display order. */
export const rankedSeries: SeriesId[] = ['wtcs', 'pto'];
