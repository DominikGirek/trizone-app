/**
 * Tobi · run — for each configured race: run its adapters, evaluate, report a verdict, and (with --write)
 * publish. Slice 3 wiring.
 *
 * Modes:
 *   (default)   DRY RUN — fetch + evaluate + print. No writes.
 *   --write     Act on the verdict: 'publish' → upsert src/data/raceResults.json (+ Supabase race_results
 *               and robot_runs if SUPABASE_SERVICE_ROLE_KEY is set); 'stage'/'fail' → log a robot_runs row
 *               (if the key is set). raceResults.json is NEVER written for a non-publish verdict.
 *   --today     Only races whose `date` == today (the GitHub Action's race-day filter). Idempotent, so an
 *               already-published race is a no-op.
 *
 * Usage:
 *   node scripts/tobi/run.mjs                        # all configured races, live, dry run
 *   node scripts/tobi/run.mjs --race=se-ch-roth      # one race
 *   node scripts/tobi/run.mjs --write --today        # race-day scheduler (used by the workflow)
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mikaAdapter } from './adapters/mika.mjs';
import { ptoAdapter } from './adapters/pto.mjs';
import { evaluate } from './core.mjs';
import { getSupabase, logRun, pushRaceResult, upsertRaceResultsFile } from './publish.mjs';
import { loadRoster } from './roster.mjs';
import { TOBI_RACES, getTobiRace } from './races.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const flag = (name) => argv.includes(`--${name}`);

async function loadAliases() {
  try {
    const j = JSON.parse(await readFile(resolve(HERE, 'aliases.json'), 'utf8'));
    return j.aliases || {};
  } catch {
    return {};
  }
}

const ICON = { publish: '🟢 PUBLISH', stage: '🟡 STAGE', fail: '🔴 FAIL' };

async function main() {
  const only = arg('race');
  const write = flag('write');
  const todayOnly = flag('today');
  const minSources = Number(arg('min-sources')) || 2;
  const today = new Date().toISOString().slice(0, 10);

  let races = only ? [getTobiRace(only)].filter(Boolean) : TOBI_RACES;
  if (only && !races.length) {
    console.error(`Unknown race: ${only}`);
    process.exit(1);
  }
  if (!only && todayOnly) races = races.filter((r) => r.date === today);
  if (!races.length) {
    console.log(todayOnly ? `No race scheduled for ${today}. Nothing to do.` : 'No races configured.');
    return;
  }

  const [roster, aliases] = await Promise.all([loadRoster(), loadAliases()]);
  const sb = write ? await getSupabase() : null;
  const mode = write ? (sb ? 'WRITE + Supabase' : 'WRITE (no SERVICE_ROLE → JSON only)') : 'dry run';
  console.log(`Tobi (${mode}) · ${roster.canonical.size} canonical / ${roster.known.size} known slugs · ${races.length} race(s) · min-sources ${minSources}\n`);

  for (const race of races) {
    // Run every adapter the race has configured (PTO, MIKA, …) → cross-source check in the core.
    const sources = (
      await Promise.all([
        race.pto ? ptoAdapter(race.pto, { topN: 5 }) : null,
        race.mika ? mikaAdapter(race.mika, { topN: 5 }) : null,
      ])
    ).filter(Boolean);
    const verdict = evaluate({ raceId: race.raceId, genders: race.genders, sources }, { aliases, roster, minSources });

    console.log(`${ICON[verdict.status]}  ${race.raceId}  — ${verdict.reason}`);
    for (const g of race.genders) console.log(`     ${g}: ${(verdict.result[g] || []).join(', ') || '—'}`);
    if (verdict.unknownSlugs.length) {
      console.log(`     ⚠ unbekannt: ${verdict.unknownSlugs.map((u) => `${u.slug} (${u.gender})`).join(', ')} → als Alias in aliases.json mappen`);
    }

    if (write) {
      if (sb) {
        try {
          await logRun(sb, verdict.run);
        } catch (e) {
          console.error(`     robot_runs: ${e.message}`);
        }
      }
      if (verdict.status === 'publish') {
        const entry = {
          raceId: race.raceId,
          men: verdict.result.men || [],
          women: verdict.result.women || [],
          source: `Tobi: ${verdict.sources.map((s) => s.source.toUpperCase()).join(' + ')} übereinstimmend (auto, ${today})`,
          verifiedAt: today,
        };
        console.log(`     → raceResults.json: ${await upsertRaceResultsFile(entry)}`);
        if (sb) {
          try {
            await pushRaceResult(sb, entry);
            console.log('     → Supabase race_results: upserted');
          } catch (e) {
            console.error(`     race_results: ${e.message}`);
          }
        } else {
          console.log('     → Supabase übersprungen (kein SUPABASE_SERVICE_ROLE_KEY)');
        }
      }
    }
    console.log('');
  }

  if (!write) {
    console.log('Dry run — nichts geschrieben. `--write` schreibt raceResults.json (+ Supabase, wenn SERVICE_ROLE gesetzt).');
  } else if (!sb) {
    console.log('Write ohne Secret: nur raceResults.json angefasst. Leaderboard-Push + robot_runs brauchen SUPABASE_SERVICE_ROLE_KEY.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
