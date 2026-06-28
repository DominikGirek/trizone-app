import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

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
  const [appleAvailable, setAppleAvailable] = useState(false);

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

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
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
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
        return error ? fail(error) : { ok: true };
      },
      verifyEmailCode: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
        return error ? fail(error) : { ok: true };
      },
      signInWithApple: async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!credential.identityToken) return { ok: false, error: 'no-identity-token' };
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
          return error ? fail(error) : { ok: true };
        } catch (e) {
          if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
            return { ok: false, error: 'canceled' };
          }
          return fail(e);
        }
      },
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
