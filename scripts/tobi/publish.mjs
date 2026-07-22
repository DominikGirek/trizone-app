/**
 * Tobi · publish — the side-effecting writes for `run.mjs --write` (kept out of the pure evaluate path).
 *   • raceResults.json    — upsert the app-bundled verified result (feeds the in-app "tip vs result" view;
 *                           committed by the GitHub Action). No secret needed.
 *   • Supabase race_results — upsert so the Tippspiel leaderboards score server-side. Needs SERVICE_ROLE.
 *   • Supabase robot_runs   — log EVERY run (publish/stage/fail) for the Cockpit. Needs SERVICE_ROLE.
 *
 * Data integrity (docs/robot-fleet.md): raceResults.json is touched ONLY for a 'publish' verdict, and
 * idempotently (identical top-5 ⇒ no write, so a hand-curated `source` string is never clobbered).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RESULTS = resolve(ROOT, 'src/data/raceResults.json');

const sameArr = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

// Match the hand-maintained raceResults.json style: object fields on their own lines, arrays inline
// with `", "` separators — so a one-entry change stays a one-entry diff.
const inlineArr = (a = []) => `[${a.map((s) => JSON.stringify(s)).join(', ')}]`;
function serialize(json) {
  const items = (json.results || []).map((r) =>
    [
      '    {',
      `      "raceId": ${JSON.stringify(r.raceId)},`,
      `      "men": ${inlineArr(r.men)},`,
      `      "women": ${inlineArr(r.women)},`,
      `      "source": ${JSON.stringify(r.source)},`,
      `      "verifiedAt": ${JSON.stringify(r.verifiedAt)}`,
      '    }',
    ].join('\n'),
  );
  return `{\n  "results": [\n${items.join(',\n')}\n  ]\n}\n`;
}

/**
 * Upsert one verified result into src/data/raceResults.json.
 * @param {{raceId:string, men:string[], women:string[], source:string, verifiedAt:string}} entry
 * @returns {Promise<'added'|'updated'|'unchanged'>}
 */
export async function upsertRaceResultsFile(entry) {
  const json = JSON.parse(await readFile(RESULTS, 'utf8'));
  json.results ||= [];
  const i = json.results.findIndex((r) => r.raceId === entry.raceId);
  if (i >= 0) {
    const ex = json.results[i];
    if (sameArr(ex.men, entry.men) && sameArr(ex.women, entry.women)) return 'unchanged';
    json.results[i] = { ...ex, ...entry };
    await writeFile(RESULTS, serialize(json));
    return 'updated';
  }
  json.results.push(entry);
  await writeFile(RESULTS, serialize(json));
  return 'added';
}

/** A Supabase admin client from env, or null if SERVICE_ROLE isn't set (dry-run / secret not added yet). */
export async function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vldepqrkbdrspgtbyyxu.supabase.co';
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Upsert race_results so the global + group leaderboards score. */
export async function pushRaceResult(sb, entry) {
  const { error } = await sb.from('race_results').upsert({
    race_id: entry.raceId,
    men: entry.men || [],
    women: entry.women || [],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Log one robot_runs row (any verdict) for the Cockpit. `run` is evaluate().run. */
export async function logRun(sb, run) {
  const { error } = await sb.from('robot_runs').insert({ ...run, ran_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/**
 * The most recent robot_runs row for a race — Tobi's memory for the TEMPORAL stability gate (did the last
 * run produce the identical top-5, and how long ago). Returns null if no client or no prior run.
 */
export async function fetchLastRun(sb, raceId) {
  if (!sb) return null;
  const { data, error } = await sb
    .from('robot_runs')
    .select('status, men, women, note, ran_at')
    .eq('robot', 'tobi')
    .eq('race_id', raceId)
    .order('ran_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return null;
  return data[0];
}
