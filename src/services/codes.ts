import { useQuery } from '@tanstack/react-query';

import { activeCodes, buildActiveCodes, type DiscountCode } from '@/lib/discountCodes';

/**
 * Live discount codes. The Code-Radar robot commits the freshest auto-published
 * set to src/data/autoCodes.json weekly; the app fetches that hosted file at
 * runtime so new codes appear WITHOUT an app update. Falls back to the bundled
 * snapshot when offline or the fetch fails. Curated codes + the blocklist are
 * applied in buildActiveCodes (the blocklist is bundled, so taking a code offline
 * still filters the freshly fetched ones too).
 */
const CODES_URL =
  process.env.EXPO_PUBLIC_CODES_URL ||
  'https://raw.githubusercontent.com/DominikGirek/trizone-app/main/src/data/autoCodes.json';

export async function fetchActiveCodes(): Promise<DiscountCode[]> {
  try {
    const res = await fetch(CODES_URL);
    if (!res.ok) throw new Error(`codes ${res.status}`);
    const json = await res.json();
    const remote = Array.isArray(json?.codes) ? (json.codes as DiscountCode[]) : [];
    return buildActiveCodes(remote);
  } catch {
    return activeCodes(); // bundled snapshot
  }
}

/** Codes: bundled snapshot shown instantly (placeholder), then refreshed from the
 *  host on mount. placeholderData (not initialData) so a fetch always runs → new
 *  weekly codes reach already-installed apps without a rebuild. */
export function useCodes() {
  return useQuery({
    queryKey: ['discount-codes'],
    queryFn: fetchActiveCodes,
    placeholderData: () => activeCodes(),
    staleTime: 1000 * 60 * 60, // 1 h
  });
}
