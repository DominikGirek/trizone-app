import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authConfigured, supabase } from '@/lib/supabase';

export type AuthResult = { ok: true } | { ok: false; error: string };
const fail = (e: unknown): AuthResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

interface AuthValue {
  ready: boolean;
  user: User | null;
  signedIn: boolean;
  /** A friendly display name: the user's handle (set later) or their email local-part. */
  displayName: string | null;
  appleAvailable: boolean;
  sendEmailCode: (email: string) => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // Apple sign-in is disabled this release (anonymous-first; package removed). Re-enable when activating B.
  const appleAvailable = false;

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
    return {
      ready,
      user,
      signedIn: !!user,
      displayName: handle ?? emailName,
      appleAvailable,
      sendEmailCode: async (email) => {
        if (!authConfigured) return { ok: false, error: 'auth-unconfigured' };
        const e = email.trim();
        // RELEASE-GATE: never lose an anonymous user's tips. If we already have an
        // anonymous account, LINK the email to that SAME account (email change) so the
        // user_id — and all their predictions — survive. Only a fresh user signs in anew.
        if (user?.is_anonymous) {
          const { error } = await supabase.auth.updateUser({ email: e });
          return error ? fail(error) : { ok: true };
        }
        const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
        return error ? fail(error) : { ok: true };
      },
      verifyEmailCode: async (email, token) => {
        // Upgrading an anonymous account confirms an email *change*; a fresh login
        // confirms an email sign-in. Same code, different verify type.
        const type = user?.is_anonymous ? 'email_change' : 'email';
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type });
        return error ? fail(error) : { ok: true };
      },
      // Disabled this release (anonymous-first). Restored when B is activated (re-add expo-apple-authentication).
      signInWithApple: async (): Promise<AuthResult> => ({ ok: false, error: 'unavailable' }),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [ready, user, appleAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
