import { fetchAndExtractOgImage } from '@/lib/ogImage';

// Server-side og:image resolver (used by the web client to avoid CORS). Takes ?url= and
// returns { image }. Cached aggressively since article previews rarely change.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url || !/^https?:\/\//i.test(url)) return Response.json({ image: null });
  try {
    const image = await fetchAndExtractOgImage(url);
    return Response.json({ image }, { headers: { 'Cache-Control': 'public, max-age=604800' } });
  } catch {
    return Response.json({ image: null });
  }
}
