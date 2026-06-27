import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Public config (anon key is meant to ship in the app). When either is missing — or on web,
// where Expo push doesn't exist — the whole feature quietly no-ops, so nothing breaks.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type InterestKind = 'athlete' | 'series' | 'brand' | 'race' | 'main_race';
export interface PushInterest {
  kind: InterestKind;
  ref_id: string;
}

export const pushAvailable = (): boolean => !!SUPABASE_URL && !!ANON && Platform.OS !== 'web';

let lastSig = '';

/**
 * Register this device's Expo push token + a full interest snapshot with the backend
 * (register_device RPC). Safe to call often: it no-ops on web / when unconfigured / when nothing
 * changed since the last successful sync. Returns true when a registration was sent. Phase B.
 */
export async function syncPush(interests: PushInterest[], locale?: string): Promise<boolean> {
  if (!pushAvailable()) return false;

  // Ask once; if the user declined, we stop here (no token, no registration).
  let granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch {
    return false;
  }

  const sig = `${token}|${locale ?? ''}|${JSON.stringify(interests)}`;
  if (sig === lastSig) return false; // unchanged since last sync

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_device`, {
      method: 'POST',
      headers: { apikey: ANON as string, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        payload: { token, platform: Platform.OS, locale: locale ?? null, pushEnabled: true, interests },
      }),
    });
    if (res.ok) lastSig = sig;
    return res.ok;
  } catch {
    return false;
  }
}
