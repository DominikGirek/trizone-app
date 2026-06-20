import { Platform } from 'react-native';

import type { Gender, RankingEntry } from '@/types';

/**
 * PTO World Rankings — scraped from the (server-rendered) PTO stats site.
 * Men: /rankings, Women: /rankings/women. Each row carries rank, country flag,
 * athlete slug + name, points and a move-up/move-down indicator.
 *
 * Mirrors the app's other live sources (DTU calendar, race news): web goes
 * through a same-origin API route (no CORS); native fetches the HTML directly.
 * Pure parsing lives here so both paths share one implementation.
 */
const PTO_BASE = 'https://stats.protriathletes.org';
export const PTO_RANKINGS_URL = PTO_BASE + '/rankings';

export function ptoUrl(gender: Gender): string {
  return gender === 'women' ? `${PTO_BASE}/rankings/women` : `${PTO_BASE}/rankings`;
}

/** Parse the PTO rankings HTML into ranking entries (top `limit`). */
export function parsePtoRanking(html: string, limit = 50): RankingEntry[] {
  const rows = html.split('class="ranking-number">').slice(1);
  const out: RankingEntry[] = [];
  for (const chunk of rows) {
    const rank = parseInt(chunk, 10);
    if (!Number.isFinite(rank)) continue;
    const slugM = chunk.match(/href="\/athlete\/([a-z0-9-]+)"/);
    if (!slugM) continue;
    const nameM = chunk.match(
      /data-popinfourl="\/athlete\/[a-z0-9-]+\/info"[^>]*>([\s\S]*?)<\/a>/,
    );
    const athleteName = nameM
      ? nameM[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const ptsM = chunk.match(/<div>([\d.,]+)<\/div><div class="expand-details"/);
    const points = ptsM ? parseFloat(ptsM[1].replace(/,/g, '')) : 0;
    const flagM = chunk.match(/flag-icon-([a-z]{2})\b/);
    const country = flagM ? flagM[1].toUpperCase() : '';
    const upM = chunk.match(/class="move-up">(\d+)/);
    const downM = chunk.match(/class="move-down">(\d+)/);
    const movement = upM ? parseInt(upM[1], 10) : downM ? -parseInt(downM[1], 10) : 0;
    if (athleteName && points) {
      out.push({ rank, athleteId: `pto:${slugM[1]}`, athleteName, country, points, movement });
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** PTO World Ranking for the given gender (live). */
export async function fetchPtoRanking(gender: Gender): Promise<RankingEntry[]> {
  if (Platform.OS === 'web') {
    const res = await fetch(`/api/pto-ranking?g=${gender}`);
    if (!res.ok) return [];
    return (await res.json()) as RankingEntry[];
  }
  const res = await fetch(ptoUrl(gender), {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
  });
  if (!res.ok) return [];
  return parsePtoRanking(await res.text());
}
