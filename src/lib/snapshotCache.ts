import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny persistent snapshot cache (AsyncStorage) for the cold-start data path.
 * Pattern: serve the last good snapshot instantly on launch, then revalidate in
 * the background — so the app opens with content immediately instead of waiting
 * on the network every single time. Best-effort: any failure is swallowed and
 * the caller falls back to a live fetch.
 */
type Snapshot<T> = { at: number; data: T };

export async function readSnapshot<T>(key: string): Promise<Snapshot<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`snap:${key}`);
    return raw ? (JSON.parse(raw) as Snapshot<T>) : null;
  } catch {
    return null;
  }
}

export async function writeSnapshot<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`snap:${key}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // best-effort; a missing snapshot just means a live fetch next launch
  }
}
