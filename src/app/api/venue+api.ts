import { fetchSwimVenue } from '@/lib/venueGeo';

// Server-side swim-venue geocoder (used by the web client to avoid CORS / keep Nominatim
// calls off the browser). ?tokens=<distinctive race tokens>&town=<town> → { venue } where
// venue is { lat, lon } only when a water feature in that town was found, else null. Cached
// hard since a venue doesn't move.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokens = url.searchParams.get('tokens') ?? '';
  const town = url.searchParams.get('town') ?? '';
  try {
    const venue = await fetchSwimVenue(tokens, town);
    return Response.json({ venue }, { headers: { 'Cache-Control': 'public, max-age=2592000' } });
  } catch {
    return Response.json({ venue: null });
  }
}
