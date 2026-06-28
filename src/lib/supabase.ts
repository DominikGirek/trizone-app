import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Only the PUBLIC anon key is ever shipped — never the service_role key. */
export const authConfigured = !!url && !!anon;

// Expo Router statically renders the web build in Node, where there's no window/localStorage. During
// that pass we must NOT touch persistent storage (it crashes "window is not defined"). Native and the
// real browser keep full session persistence; only the SSR pass runs storage-less.
const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Single Supabase client for auth (and later: tips/groups). Sessions persist via AsyncStorage and
 * auto-refresh; `detectSessionInUrl` is off (we use email-OTP + native Apple, not web redirects).
 */
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anon ?? 'public-anon', {
  auth: isWebSSR
    ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    : { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
