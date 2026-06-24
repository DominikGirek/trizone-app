import { Platform } from 'react-native';

import { dropPastEventNews, raceNewsKeywords } from '@/lib/newsTopics';
import { seriesEvents } from '@/mocks/seriesEvents';
import { aggregateFeeds } from '@/services/rss';
import type { Article } from '@/types';

/** Distinctive tokens of the big series races that are already over — cheap + synchronous
 *  (static seriesEvents), so we can prune stale previews ("IRONMAN Hamburg: Zeitplan …"). */
function finishedRaceTokens(): Set<string> {
  const now = Date.now();
  const out = new Set<string>();
  for (const e of seriesEvents) {
    if (+new Date(e.date) < now) raceNewsKeywords(e.name, e.town).forEach((k) => out.add(k));
  }
  return out;
}

/**
 * News source strategy:
 * - Web: fetch the same-origin `/api/news` route, which aggregates feeds
 *   server-side (no browser CORS, no flaky third-party proxy).
 * - Native (iOS/Android): fetch the RSS feeds directly — native networking is
 *   not subject to CORS.
 * In both cases stale previews of races that have already happened are pruned.
 */
export async function fetchNews(): Promise<Article[]> {
  let articles: Article[];
  if (Platform.OS === 'web') {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(`news request failed: ${res.status}`);
    articles = (await res.json()) as Article[];
  } else {
    articles = await aggregateFeeds();
  }
  return dropPastEventNews(articles, finishedRaceTokens());
}
