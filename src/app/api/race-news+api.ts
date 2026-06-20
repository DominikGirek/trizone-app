import { fetchGoogleNews } from '@/services/rss';

// Server-side per-race news (Google News RSS), used by the web client.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (!q) return Response.json([]);
  try {
    const articles = await fetchGoogleNews(q);
    return Response.json(articles, {
      headers: { 'Cache-Control': 'public, max-age=900' },
    });
  } catch {
    return Response.json([], { status: 200 });
  }
}
