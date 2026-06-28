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

// ── Handle (public leaderboard name) ───────────────────────────────────────────
/** The caller's chosen public name, or null if none set / not signed in. Never creates a session. */
export async function fetchMyHandle(): Promise<string | null> {
  if (!authConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return null;
  const { data: row } = await supabase.from('profiles').select('handle').eq('id', uid).maybeSingle();
  return row?.handle ?? null;
}

/** Set the public name. Creates an (anonymous) identity if needed. `taken` if the name is in use. */
export async function setMyHandle(handle: string): Promise<{ ok: boolean; error?: 'taken' | 'failed' }> {
  if (!authConfigured) return { ok: false, error: 'failed' };
  const uid = await ensureSession();
  if (!uid) return { ok: false, error: 'failed' };
  const { error } = await supabase.from('profiles').upsert({ id: uid, handle: handle.trim() });
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) return { ok: false, error: 'taken' };
    return { ok: false, error: 'failed' };
  }
  return { ok: true };
}

// ── Groups (P4) ───────────────────────────────────────────────────────────────
export interface Group {
  id: string;
  name: string;
  invite_code: string;
  is_public: boolean;
  members?: number;
}
export interface GlobalGroupRow {
  group_id: string;
  name: string;
  members: number;
  avg_points: number;
}

/** Create a group; the caller becomes owner + first member. Throws on error so the UI can show it. */
export async function createGroup(name: string): Promise<Group> {
  if (!authConfigured) throw new Error('auth not configured');
  const uid = await ensureSession();
  if (!uid) throw new Error('sign-in failed');
  const { data, error } = await supabase.rpc('create_group', { p_name: name });
  if (error) throw error;
  return (data as Group[])[0];
}

/** Join a group by invite code. Throws if the code is unknown. */
export async function joinGroup(code: string): Promise<{ id: string; name: string }> {
  if (!authConfigured) throw new Error('auth not configured');
  const uid = await ensureSession();
  if (!uid) throw new Error('sign-in failed');
  const { data, error } = await supabase.rpc('join_group', { p_code: code });
  if (error) throw error;
  return (data as { id: string; name: string }[])[0];
}

/** The caller's groups (with member counts). */
export async function fetchMyGroups(): Promise<Group[]> {
  if (!authConfigured) return [];
  const uid = await ensureSession();
  if (!uid) return [];
  const { data, error } = await supabase.rpc('my_groups');
  if (error || !data) return [];
  return data as Group[];
}

/** A group's member leaderboard (members only; points, never picks). */
export async function fetchGroupLeaderboard(groupId: string): Promise<LeaderboardRow[]> {
  if (!authConfigured) return [];
  const uid = await ensureSession();
  if (!uid) return [];
  const { data, error } = await supabase.rpc('group_leaderboard', { p_group: groupId });
  if (error || !data) return [];
  return data as LeaderboardRow[];
}

/** Owner opt-in: show this group in the global group ranking (default off). */
export async function setGroupPublic(groupId: string, isPublic: boolean): Promise<void> {
  if (!authConfigured) return;
  await ensureSession();
  await supabase.rpc('set_group_public', { p_group: groupId, p_public: isPublic });
}

/** Global ranking of opt-in public groups (by avg points/member). Browsable without an account. */
export async function fetchGroupGlobalLeaderboard(limit = 100): Promise<GlobalGroupRow[]> {
  if (!authConfigured) return [];
  const { data, error } = await supabase.rpc('group_global_leaderboard', { limit_n: limit });
  if (error || !data) return [];
  return data as GlobalGroupRow[];
}
