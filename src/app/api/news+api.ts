import { aggregateFeeds } from '@/services/rss';

// Server-side news aggregation endpoint (used by the web client).
export async function GET() {
  try {
    const articles = await aggregateFeeds();
    return Response.json(articles, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return Response.json([], { status: 200 });
  }
}
