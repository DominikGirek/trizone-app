/**
 * fetch with a hard timeout via AbortController, so a slow/dead host can never
 * stall a screen indefinitely (the cold-start path fans out to several flaky
 * third-party feeds). On timeout the underlying fetch rejects with an AbortError
 * — callers already wrap network calls in try/catch + fallbacks.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
