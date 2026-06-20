import { rankedSeries, rankings } from '@/mocks/rankings';
import { fetchPtoRanking } from '@/services/proRankings';
import { fetchWtcsRanking } from '@/services/worldTriathlon';
import type { Gender, RankingTable, SeriesId } from '@/types';

const delay = <T>(value: T, ms = 80) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const season = () => String(new Date().getFullYear());

export function getRankedSeries(): SeriesId[] {
  return rankedSeries;
}

export async function getRanking(
  series: SeriesId,
  gender: Gender,
): Promise<RankingTable | undefined> {
  // WTCS + PTO come from real sources; others stay on sample data.
  if (series === 'wtcs') {
    try {
      const { entries, published } = await fetchWtcsRanking(gender);
      if (entries.length) {
        return {
          series,
          gender,
          season: season(),
          entries,
          updatedAt: published,
          source: 'World Triathlon',
        };
      }
    } catch {
      // fall through to mock
    }
  }
  if (series === 'pto') {
    try {
      const entries = await fetchPtoRanking(gender);
      if (entries.length) {
        return {
          series,
          gender,
          season: season(),
          entries,
          updatedAt: new Date().toISOString(),
          source: 'PTO World Rankings',
        };
      }
    } catch {
      // fall through to mock
    }
  }
  return delay(rankings.find((r) => r.series === series && r.gender === gender));
}
