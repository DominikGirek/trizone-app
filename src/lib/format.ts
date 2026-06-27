import type { AppLanguage } from '@/i18n';

/** Lower-case + strip diacritics, so a "brunnee" query still matches "Brunnée". */
export const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Continent code for an ISO-2 country (used for the events filter). */
export type ContinentCode = 'EU' | 'NA' | 'SA' | 'AS' | 'OC' | 'AF' | 'OT';

const CONTINENTS: Record<string, ContinentCode> = {
  // Europe
  DE: 'EU', AT: 'EU', CH: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', PT: 'EU', NL: 'EU', BE: 'EU',
  LU: 'EU', GB: 'EU', IE: 'EU', DK: 'EU', SE: 'EU', NO: 'EU', FI: 'EU', IS: 'EU', PL: 'EU',
  CZ: 'EU', SK: 'EU', HU: 'EU', SI: 'EU', HR: 'EU', RS: 'EU', RO: 'EU', BG: 'EU', GR: 'EU',
  EE: 'EU', LV: 'EU', LT: 'EU', UA: 'EU', TR: 'EU',
  // North America
  US: 'NA', CA: 'NA', MX: 'NA',
  // South America
  BR: 'SA', AR: 'SA', CL: 'SA', CO: 'SA', PE: 'SA', UY: 'SA',
  // Asia
  JP: 'AS', CN: 'AS', KR: 'AS', SG: 'AS', MY: 'AS', TH: 'AS', ID: 'AS', PH: 'AS', IN: 'AS',
  AE: 'AS', QA: 'AS', SA: 'AS', IL: 'AS', HK: 'AS', TW: 'AS', UZ: 'AS',
  // Oceania
  AU: 'OC', NZ: 'OC',
  // Africa
  ZA: 'AF', EG: 'AF', MA: 'AF', TN: 'AF', KE: 'AF',
};

export function continentOf(iso2: string): ContinentCode {
  return CONTINENTS[(iso2 || '').toUpperCase()] ?? 'OT';
}

/** Short localized month name for a month index (0-11). */
export function monthShort(monthIndex: number, lang: AppLanguage): string {
  return new Date(2026, monthIndex, 1).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
    month: 'short',
  });
}

/** ISO-2 country code → flag emoji (regional indicator symbols). */
export function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '🏳️';
  const base = 0x1f1e6;
  const code = iso2.toUpperCase();
  return String.fromCodePoint(
    base + (code.charCodeAt(0) - 65),
    base + (code.charCodeAt(1) - 65),
  );
}

/** Localized, compact date like "18. Juni" / "Jun 18". */
export function formatDate(iso: string, lang: AppLanguage): string {
  return new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateTime(iso: string, lang: AppLanguage): string {
  return new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Relative "time ago" string for news timestamps. */
export function timeAgo(iso: string, lang: AppLanguage): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  const de = lang === 'de';
  if (mins < 1) return de ? 'gerade eben' : 'just now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return de ? `vor ${hours} Std` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return de ? `vor ${days} T` : `${days}d ago`;
  return formatDate(iso, lang);
}

/**
 * Derives an event's status from its date — never hard-code status, so it can
 * never drift out of sync with the real date. `live` = same calendar day.
 */
export function eventStatusFromDate(iso: string): 'upcoming' | 'live' | 'finished' {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() < now.getTime()) return 'finished';
  if (day.getTime() === now.getTime()) return 'live';
  return 'upcoming';
}

/** Great-circle distance between two coordinates, in kilometers. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

export function countdownTo(iso: string): CountdownParts {
  const diff = new Date(iso).getTime() - Date.now();
  const past = diff <= 0;
  const abs = Math.abs(diff);
  return {
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
    past,
  };
}
