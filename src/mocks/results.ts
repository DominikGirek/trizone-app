import type { RaceResult } from '@/types';

// Sample race results keyed by race id (only for races with hasResults = true).
export const resultsByRace: Record<string, RaceResult[]> = {
  'r-finished-1': [
    { position: 1, athleteId: 'a3', athleteName: 'Oliver Hayes', country: 'GB', totalTime: '1:43:12', splits: { swim: '18:02', bike: '54:40', run: '28:30' } },
    { position: 2, athleteId: 'a1', athleteName: 'Lukas Brenner', country: 'DE', totalTime: '1:43:25', splits: { swim: '18:05', bike: '54:38', run: '28:42' } },
    { position: 3, athleteId: 'a2', athleteName: 'Mateo Rinaldi', country: 'IT', totalTime: '1:43:51', splits: { swim: '18:01', bike: '54:44', run: '29:06' } },
    { position: 4, athleteId: 'a4', athleteName: 'Tomás Vidal', country: 'ES', totalTime: '1:44:33', splits: { swim: '18:30', bike: '54:50', run: '29:13' } },
  ],
  'r-finished-2': [
    { position: 1, athleteId: 'a9', athleteName: 'Jens Holm', country: 'NO', totalTime: '3:38:54', splits: { swim: '23:10', bike: '2:02:18', run: '1:09:55' } },
    { position: 2, athleteId: 'a10', athleteName: 'Rafael Costa', country: 'BR', totalTime: '3:41:07', splits: { swim: '23:44', bike: '2:03:30', run: '1:10:48' } },
    { position: 3, athleteId: 'a4', athleteName: 'Tomás Vidal', country: 'ES', totalTime: '3:42:40', splits: { swim: '24:02', bike: '2:03:10', run: '1:11:20' } },
  ],
  'r-finished-3': [
    { position: 1, athleteId: 'a8', athleteName: 'Mia Donato', country: 'AU', totalTime: '3:55:21', splits: { swim: '25:40', bike: '2:12:05', run: '1:14:30' } },
    { position: 2, athleteId: 'a11', athleteName: 'Nora Fischer', country: 'CH', totalTime: '3:57:48', splits: { swim: '26:02', bike: '2:13:11', run: '1:15:20' } },
    { position: 3, athleteId: 'a6', athleteName: 'Sophie Laurent', country: 'FR', totalTime: '3:59:02', splits: { swim: '25:55', bike: '2:14:40', run: '1:15:50' } },
    { position: 4, athleteId: 'a12', athleteName: 'Yuki Tanaka', country: 'JP', totalTime: '4:01:18', dnf: false },
  ],
};
