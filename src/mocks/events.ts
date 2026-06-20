import { eventStatusFromDate } from '@/lib/format';
import type { Race } from '@/types';

/**
 * Emergency fallback only — used if the World Triathlon API is unreachable.
 * Dates are relative so the fallback stays plausibly "current"; status is always
 * derived from the date (never hard-coded) so it can't show a false "live".
 */
function daysFromNow(n: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

type SeedRace = Omit<Race, 'status'>;

const seed: SeedRace[] = [
  { id: 'r-finished-1', name: 'WTCS Yokohama', series: 'wtcs', format: 'olympic', location: 'Yokohama', country: 'JP', date: daysFromNow(-31), hasResults: true, lat: 35.4437, lon: 139.638 },
  { id: 'r-finished-2', name: 'IRONMAN 70.3 Mallorca', series: 'ironman703', format: 'middle', location: 'Alcúdia', country: 'ES', date: daysFromNow(-14), hasResults: true, lat: 39.85, lon: 3.12 },
  { id: 'r-finished-3', name: 'T100 San Francisco', series: 't100', format: 'middle', location: 'San Francisco', country: 'US', date: daysFromNow(-4), hasResults: true, lat: 37.7749, lon: -122.4194 },
  { id: 'r-up-1', name: 'IRONMAN 70.3 Kraichgau', series: 'ironman703', format: 'middle', location: 'Kraichgau', country: 'DE', date: daysFromNow(6), hasResults: false, lat: 49.23, lon: 8.78 },
  { id: 'r-up-2', name: 'PTO European Open', series: 'pto', format: 'middle', location: 'Ibiza', country: 'ES', date: daysFromNow(13), hasResults: false, lat: 38.9067, lon: 1.4206 },
  { id: 'r-up-3', name: 'WTCS Montréal', series: 'wtcs', format: 'olympic', location: 'Montréal', country: 'CA', date: daysFromNow(27), hasResults: false, lat: 45.5019, lon: -73.5674 },
  { id: 'r-up-4', name: 'T100 London', series: 't100', format: 'middle', location: 'London', country: 'GB', date: daysFromNow(41), hasResults: false, lat: 51.5074, lon: -0.1278 },
  { id: 'r-up-5', name: 'IRONMAN Frankfurt', series: 'ironman', format: 'long', location: 'Frankfurt', country: 'DE', date: daysFromNow(58), hasResults: false, lat: 50.1109, lon: 8.6821 },
];

export const races: Race[] = seed.map((r) => ({ ...r, status: eventStatusFromDate(r.date) }));

export const racesById: Record<string, Race> = Object.fromEntries(
  races.map((r) => [r.id, r]),
);
