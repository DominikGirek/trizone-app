import { parsePtoRanking, ptoUrl } from '@/services/proRankings';
import type { Gender } from '@/types';

// Server-side PTO World Ranking (scraped HTML), used by the web client.
export async function GET(request: Request) {
  const g = new URL(request.url).searchParams.get('g');
  const gender: Gender = g === 'women' ? 'women' : 'men';
  try {
    const res = await fetch(ptoUrl(gender), {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    });
    if (!res.ok) return Response.json([], { status: 200 });
    const entries = parsePtoRanking(await res.text());
    return Response.json(entries, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return Response.json([], { status: 200 });
  }
}
