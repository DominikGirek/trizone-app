// Pure, runtime-agnostic og:image helpers (no react-native import) so both the client
// service and the server API route can share them.

// Social-preview image carriers, best → fallback.
const META_PROPS = ['og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image', 'twitter:image:src'];

export function extractOgImageFromHtml(html: string): string | null {
  const head = html.slice(0, 250_000); // preview meta lives in <head>; cap the work
  for (const prop of META_PROPS) {
    // content can come before OR after the property attribute (both orderings occur)
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*\\bcontent=["']([^"']+)["']` +
        `|<meta[^>]+\\bcontent=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i',
    );
    const m = head.match(re);
    const url = m?.[1] ?? m?.[2];
    if (url && /^https?:\/\//i.test(url)) return url.replace(/&amp;/g, '&');
  }
  return null;
}

/** Fetch a page and pull its og:image. Resilient: any failure → null. */
export async function fetchAndExtractOgImage(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return extractOgImageFromHtml(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
