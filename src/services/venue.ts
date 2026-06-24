import { Platform } from 'react-native';

import { fetchSwimVenue, type VenuePoint } from '@/lib/venueGeo';

/** Resolve a local race's swim venue to coordinates (web → same-origin /api/venue, no CORS;
 *  native → direct). Returns null unless a water feature in the town was found — so the
 *  caller can safely fall back to a plain search. */
export async function swimVenue(tokens: string, town: string): Promise<VenuePoint | null> {
  if (!tokens.trim() || !town.trim()) return null;
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`/api/venue?tokens=${encodeURIComponent(tokens)}&town=${encodeURIComponent(town)}`);
      if (!res.ok) return null;
      return ((await res.json()) as { venue: VenuePoint | null }).venue ?? null;
    }
    return await fetchSwimVenue(tokens, town);
  } catch {
    return null;
  }
}
