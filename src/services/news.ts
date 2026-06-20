import { Platform } from 'react-native';

import { aggregateFeeds } from '@/services/rss';
import type { Article } from '@/types';

/**
 * News source strategy:
 * - Web: fetch the same-origin `/api/news` route, which aggregates feeds
 *   server-side (no browser CORS, no flaky third-party proxy).
 * - Native (iOS/Android): fetch the RSS feeds directly — native networking is
 *   not subject to CORS.
 */
export async function fetchNews(): Promise<Article[]> {
  if (Platform.OS === 'web') {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(`news request failed: ${res.status}`);
    return (await res.json()) as Article[];
  }
  return aggregateFeeds();
}
