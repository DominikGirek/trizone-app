import { authConfigured, supabase } from '@/lib/supabase';
import type { Picks } from '@/lib/tippspiel';
import type { StoredTip } from '@/store/tips';

export interface LeaderboardRow {
  user_id: string;
  handle: string;
  points: number;
  races: number;
}

// Postgres text[] holds empty strings, not nulls, for un-picked slots.
const clean = (picks: Picks): string[] => picks.map((p) => p ?? '');

/**
 * Ensure we have an identity to write under. Login-at-write: if the user isn't signed in (email/Apple),
 * fall back to an ANONYMOUS Supabase session so they can tip instantly and "claim" the account later.
 * Returns the user id, or null if auth isn't configured / anonymous sign-in is disabled.
 */
export async function ensureSession(): Promise<string | null> {
  if (!authConfigured) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return anon.user?.id ?? null;
}

/** Upsert the user's single tip for a race. Best-effort: no-ops if unconfigured/offline. */
export async function syncPrediction(raceId: string, tip: StoredTip): Promise<void> {
  if (!authConfigured) return;
  const uid = await ensureSession();
  if (!uid) return;
  await supabase.from('predictions').upsert({
    user_id: uid,
    race_id: raceId,
    race_name: tip.name ?? null,
    race_date: tip.date ?? null,
    kind: tip.kind ?? null,
    men: clean(tip.men),
    women: clean(tip.women),
    updated_at: new Date().toISOString(),
  });
}

/** Global leaderboard (points only) via the SECURITY DEFINER RPC. Empty until results are scored. */
export async function fetchLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  if (!authConfigured) return [];
  const { data, error } = await supabase.rpc('leaderboard', { limit_n: limit });
  if (error || !data) return [];
  return data as LeaderboardRow[];
}
