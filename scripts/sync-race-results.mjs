#!/usr/bin/env node
/*
 * Push VERIFIED race results (src/data/raceResults.json) into Supabase `race_results` so the Tippspiel
 * leaderboards (global + every group) score automatically — the scoring runs server-side in plpgsql.
 *
 * Needs the SERVICE ROLE key (admin) because race_results is RLS-locked for writes. Provide it via env;
 * it is NEVER committed or shipped (only the public anon key ships in the app).
 *
 *   SUPABASE_SERVICE_ROLE_KEY=xxxxx npm run sync:results
 *
 * Optional env: EXPO_PUBLIC_SUPABASE_URL (defaults to the TriZone project).
 * Idempotent: upserts by race_id, so re-running after adding a result is safe.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://vldepqrkbdrspgtbyyxu.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY is required (admin key — never commit it).');
  process.exit(1);
}

const { results } = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'raceResults.json'), 'utf8'));
if (!results?.length) {
  console.log('Nothing to sync — src/data/raceResults.json has no results yet.');
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let ok = 0;
for (const r of results) {
  if (!r.raceId || !Array.isArray(r.men) || !Array.isArray(r.women)) {
    console.warn('skip malformed entry:', r);
    continue;
  }
  const { error } = await supabase.from('race_results').upsert({
    race_id: r.raceId,
    men: r.men,
    women: r.women,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error(`✗ ${r.raceId}: ${error.message}`);
  else {
    console.log(`✓ ${r.raceId} (${r.men.length}M / ${r.women.length}W) — ${r.source}`);
    ok++;
  }
}
console.log(`\nDone: ${ok}/${results.length} result(s) synced to Supabase.`);
