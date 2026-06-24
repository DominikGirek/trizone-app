import { Platform } from 'react-native';

import { fetchAndExtractOgImage } from '@/lib/ogImage';

/** Resolve a preview image for an article that ships none. Web goes through the same-origin
 *  /api/og-image route (no CORS); native fetches directly. Google News links are encoded
 *  redirects that never expose an image, so we don't even try them. Any failure → null. */
export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  if (!articleUrl || !/^https?:\/\//i.test(articleUrl)) return null;
  if (/(^|\.)news\.google\.com/i.test(articleUrl)) return null;
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`/api/og-image?url=${encodeURIComponent(articleUrl)}`);
      if (!res.ok) return null;
      return ((await res.json()) as { image: string | null }).image ?? null;
    }
    return await fetchAndExtractOgImage(articleUrl);
  } catch {
    return null;
  }
}
