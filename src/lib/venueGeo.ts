// Pure, runtime-agnostic swim-venue geocoder (no react-native import) shared by the client
// service and the server API route. Resolves a local race to its swim water body via OSM
// Nominatim, but ONLY accepts a result that is actually a WATER feature AND lies in the
// queried town — so it can never drop a falsely-precise or wrong pin (the caller then falls
// back to a plain search).

export type VenuePoint = { lat: number; lon: number };

// OSM class/type combos that are a swimmable water body (lake/river/sea/bay/beach/marina …).
function isWater(r: { class?: string; type?: string }): boolean {
  const c = r.class ?? '';
  const t = r.type ?? '';
  if (c === 'water' || c === 'waterway') return true;
  if (c === 'natural' && ['water', 'bay', 'beach', 'wetland', 'strait', 'coastline'].includes(t)) return true;
  if (c === 'leisure' && ['marina', 'swimming_area', 'water_park', 'beach_resort'].includes(t)) return true;
  if (c === 'place' && t === 'sea') return true;
  return false;
}

/** Geocode "<distinctive tokens> <town>" and return coordinates ONLY when the best match is
 *  a water feature located in that town. Any uncertainty → null. */
export async function fetchSwimVenue(tokens: string, town: string): Promise<VenuePoint | null> {
  const q = `${tokens} ${town}`.trim();
  if (!tokens.trim() || !town.trim()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}`,
      {
        headers: { 'User-Agent': 'TriZone/1.0 (triathlon app; contact dgirek@gmail.com)' },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: string; lon: string; class?: string; type?: string; display_name?: string }[];
    const townLc = town.toLowerCase();
    const hit = arr.find((r) => isWater(r) && (r.display_name ?? '').toLowerCase().includes(townLc));
    return hit ? { lat: +(+hit.lat).toFixed(5), lon: +(+hit.lon).toFixed(5) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
