import { Platform } from 'react-native';

import { dropPastEventNews, raceNewsKeywords } from '@/lib/newsTopics';
import { readSnapshot, writeSnapshot } from '@/lib/snapshotCache';
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
let newsRefreshing = false;
const NEWS_TTL = 15 * 60 * 1000; // serve cached instantly, but revalidate often (breaking news)

function refreshNewsInBackground(): void {
  if (newsRefreshing) return;
  newsRefreshing = true;
  aggregateFeeds()
    .then((a) => (a.length ? writeSnapshot('news', a) : undefined))
    .catch(() => {})
    .finally(() => {
      newsRefreshing = false;
    });
}

export async function fetchNews(): Promise<Article[]> {
  const tokens = finishedRaceTokens();

  if (Platform.OS === 'web') {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(`news request failed: ${res.status}`);
    const articles = (await res.json()) as Article[];
    return dropPastEventNews(articles, tokens);
  }

  // Native: serve the last good snapshot INSTANTLY for a fast open, then
  // revalidate in the background so fresh news lands on the next read.
  const snap = await readSnapshot<Article[]>('news');
  if (snap?.data?.length) {
    if (Date.now() - snap.at > NEWS_TTL) refreshNewsInBackground();
    return dropPastEventNews(snap.data, tokens);
  }

  const fresh = await aggregateFeeds();
  if (fresh.length) void writeSnapshot('news', fresh);
  return dropPastEventNews(fresh, tokens);
}
