import type { User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authConfigured, loginEnabled, supabase } from '@/lib/supabase';

export type OAuthProvider = 'apple' | 'google';
export type AuthResult = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): AuthResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

// Where the OAuth browser sheet returns to. `trizone://` is the app's registered scheme (app.json), so the
// redirect re-opens the app — no native module needed (stays OTA-deliverable).
const redirectTo = Linking.createURL('auth-callback');
// No-op on native; needed on web to finish a popup auth. Safe to call at module load.
WebBrowser.maybeCompleteAuthSession();

/** Pull auth params out of the redirect URL — handles both PKCE (`?code`) and implicit (`#access_token`). */
function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.split('?')[1]?.split('#')[0];
  const frag = url.split('#')[1];
  for (const part of [q, frag]) {
    if (!part) continue;
    for (const [k, v] of new URLSearchParams(part)) out[k] = v;
  }
  return out;
}

/** Map a raw Supabase error to a stable code the UI can translate; otherwise pass the message through. */
function codeFor(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already') && (m.includes('registered') || m.includes('in use') || m.includes('exists'))) return 'email-taken';
  if (m.includes('rate limit') || m.includes('too many')) return 'rate-limited';
  if (m.includes('expired')) return 'expired';
  if (m.includes('invalid') && m.includes('token')) return 'code-wrong';
  return msg;
}

interface AuthValue {
  ready: boolean;
  enabled: boolean;
  user: User | null;
  signedIn: boolean;
  /** True while still an anonymous account (tips work, but "secure your account" applies). */
  isAnonymous: boolean;
  /** A friendly display name: the user's handle (set later) or their email local-part. */
  displayName: string | null;
  appleAvailable: boolean;
  googleAvailable: boolean;
  /** Apple/Google via Supabase OAuth in a secure browser sheet. LINKS to the anon account (tips survive). */
  signInWithProvider: (provider: OAuthProvider) => Promise<AuthResult>;
  sendEmailCode: (email: string) => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const handle = (user?.user_metadata?.handle as string | undefined) ?? null;
    const emailName = user?.email ? user.email.split('@')[0] : null;
    const isAnonymous = !!user?.is_anonymous;

    return {
      ready,
      enabled: loginEnabled,
      user,
      signedIn: !!user && !isAnonymous,
      isAnonymous,
      displayName: handle ?? emailName,
      appleAvailable: loginEnabled && authConfigured && Platform.OS === 'ios',
      googleAvailable: loginEnabled && authConfigured,

      signInWithProvider: async (provider) => {
        if (!authConfigured) return { ok: false, error: 'auth-unconfigured' };
        try {
          // Anonymous → LINK the provider to the SAME user so predictions survive. Otherwise a fresh sign-in.
          const linking = isAnonymous;
          const options = { redirectTo, skipBrowserRedirect: true } as const;
          const { data, error } = linking
            ? await supabase.auth.linkIdentity({ provider, options })
            : await supabase.auth.signInWithOAuth({ provider, options });
          if (error) return { ok: false, error: codeFor(error.message) };
          if (!data?.url) return { ok: false, error: 'no-url' };

          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (res.type !== 'success') return { ok: false, error: 'cancelled' };

          const p = paramsFromUrl(res.url);
          if (p.error || p.error_description) return { ok: false, error: codeFor(p.error_description || p.error) };
          if (p.code) {
            const { error: exErr } = await supabase.auth.exchangeCodeForSession(p.code);
            if (exErr) return { ok: false, error: codeFor(exErr.message) };
          } else if (p.access_token && p.refresh_token) {
            const { error: sErr } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
            if (sErr) return { ok: false, error: codeFor(sErr.message) };
          }
          return { ok: true };
        } catch (e) {
          return fail(e);
        }
      },

      sendEmailCode: async (email) => {
        if (!authConfigured) return { ok: false, error: 'auth-unconfigured' };
        const e = email.trim();
        // RELEASE-GATE: never lose an anonymous user's tips. If we already have an anonymous account, LINK
        // the email to that SAME account (email change) so the user_id — and all predictions — survive.
        // Only a brand-new user signs in anew.
        if (isAnonymous) {
          const { error } = await supabase.auth.updateUser({ email: e });
          return error ? { ok: false, error: codeFor(error.message) } : { ok: true };
        }
        const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
        return error ? { ok: false, error: codeFor(error.message) } : { ok: true };
      },

      verifyEmailCode: async (email, token) => {
        // Upgrading an anonymous account confirms an email *change*; a fresh login confirms an email sign-in.
        const type = isAnonymous ? 'email_change' : 'email';
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type });
        return error ? { ok: false, error: codeFor(error.message) } : { ok: true };
      },

      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
