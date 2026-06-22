import { Platform } from 'react-native';

import { fetchGoogleNews } from '@/services/rss';
import type { Article } from '@/types';

/**
 * News about a specific race (incl. local/regional press) via Google News.
 * Mirrors the news pipeline: web → same-origin `/api/race-news` route
 * (server-side, no CORS); native → Google News RSS directly.
 */
export async function fetchRaceNews(query: string): Promise<Article[]> {
  if (!query.trim()) return [];
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`/api/race-news?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return (await res.json()) as Article[];
    }
    return await fetchGoogleNews(query);
  } catch {
    return [];
  }
}

/** Current news about a specific athlete (name-scoped to the triathlon context). */
export function fetchAthleteNews(name: string): Promise<Article[]> {
  if (!name.trim()) return Promise.resolve([]);
  return fetchRaceNews(`"${name}" Triathlon`);
}
