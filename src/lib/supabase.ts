import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Only the PUBLIC anon key is ever shipped — never the service_role key. */
export const authConfigured = !!url && !!anon;

/**
 * Whether email/Apple account-securing ("B") is live. Stays false until the owner has set up the Resend
 * SMTP + Apple provider in Supabase (and a fresh build). While false, the app is anonymous-only and the
 * "secure your account" CTA shows an honest "coming soon" instead of a broken login. Flip via
 * EXPO_PUBLIC_LOGIN_ENABLED=true.
 */
export const loginEnabled = process.env.EXPO_PUBLIC_LOGIN_ENABLED === 'true';

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
    : {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // CRITICAL on React Native: the default lock uses navigator.locks, which isn't available on RN, so
        // every auth call (getSession on launch!) waited ~10s for the lock-acquire timeout — the cold-start
        // freeze. processLock is a JS-promise lock that works on RN.
        lock: processLock,
      },
});
