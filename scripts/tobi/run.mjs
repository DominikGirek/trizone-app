/**
 * Tobi · run — self-discovering results robot. Iterates the tippable-race registry (raceMap.json), skips
 * races already fully published, fetches each race's sources (PTO always; MIKA where configured), and —
 * in --write mode — publishes when the confidence gate clears (≥2 sources agree, OR a single source is
 * stable across two runs ≥~45 min apart). Fully hands-off: no per-race dates, no manual triggering.
 *
 * Timing needs no date logic: a race that hasn't happened returns no finishers → skipped silently; a
 * finished race clears the gate and publishes; a published race is skipped next run. Runs hourly (workflow).
 *
 * Usage:
 *   node scripts/tobi/run.mjs                       # all registry races, live, dry run
 *   node scripts/tobi/run.mjs --race=se-ch-roth     # one race (ignores the already-published skip)
 *   node scripts/tobi/run.mjs --write               # publish/stage/log (Supabase if SERVICE_ROLE set)
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mikaAdapter } from './adapters/mika.mjs';
import { ptoAdapter } from './adapters/pto.mjs';
import { evaluate } from './core.mjs';
import { fetchLastRun, getSupabase, logRun, pushRaceResult, upsertRaceResultsFile } from './publish.mjs';
import { loadRoster } from './roster.mjs';
import { loadTobiRaces, getTobiRace } from './races.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const flag = (name) => argv.includes(`--${name}`);

const TOP_N = 5;
const ICON = { publish: '🟢 PUBLISH', stage: '🟡 STAGE', fail: '🔴 FAIL' };

async function loadAliases() {
  try {
    return JSON.parse(await readFile(resolve(HERE, 'aliases.json'), 'utf8')).aliases || {};
  } catch {
    return {};
  }
}

/** raceId → {men, women} of the currently PUBLISHED verified results (to skip finished races). */
async function loadPublished() {
  try {
    const j = JSON.parse(await readFile(resolve(ROOT, 'src/data/raceResults.json'), 'utf8'));
    return Object.fromEntries((j.results || []).map((r) => [r.raceId, r]));
  } catch {
    return {};
  }
}
const isComplete = (entry, genders) => !!entry && genders.every((g) => (entry[g]?.length ?? 0) >= TOP_N);
const sourcesHaveData = (sources) =>
  sources.some((s) => s.ok && ((s.men && s.men.length) || (s.women && s.women.length)));

async function main() {
  const only = arg('race');
  const write = flag('write');
  const minSources = Number(arg('min-sources')) || 2;
  const now = Date.now();

  let races = only ? [await getTobiRace(only)].filter(Boolean) : await loadTobiRaces();
  if (only && !races.length) {
    console.error(`Unknown race: ${only}`);
    process.exit(1);
  }

  const [roster, aliases, published] = await Promise.all([loadRoster(), loadAliases(), loadPublished()]);
  const sb = write ? await getSupabase() : null;
  const mode = write ? (sb ? 'WRITE + Supabase' : 'WRITE (no SERVICE_ROLE → JSON only)') : 'dry run';
  console.log(`Tobi (${mode}) · ${roster.canonical.size} canonical slugs · ${races.length} race(s) · min-sources ${minSources}\n`);

  let acted = 0;
  for (const race of races) {
    // Skip races already fully published — no fetch needed (unless a single race was explicitly requested).
    if (!only && isComplete(published[race.raceId], race.genders)) continue;

    const sources = (
      await Promise.all([
        race.pto ? ptoAdapter(race.pto, { topN: TOP_N }) : null,
        race.mika ? mikaAdapter(race.mika, { topN: TOP_N }) : null,
      ])
    ).filter(Boolean);

    // No finishers anywhere ⇒ the race simply hasn't happened yet. Skip silently (no log noise).
    if (!only && !sourcesHaveData(sources)) continue;

    const previousRun = sb ? await fetchLastRun(sb, race.raceId) : null;
    const verdict = evaluate(
      { raceId: race.raceId, genders: race.genders, sources },
      { aliases, roster, minSources, previousRun, now },
    );
    acted++;

    console.log(`${ICON[verdict.status]}  ${race.raceId}  — ${verdict.reason}`);
    for (const g of race.genders) console.log(`     ${g}: ${(verdict.result[g] || []).join(', ') || '—'}`);
    if (verdict.unknownSlugs.length) {
      console.log(`     ⚠ unbekannt: ${verdict.unknownSlugs.map((u) => `${u.slug} (${u.gender})`).join(', ')} → Alias in aliases.json`);
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
          source: `Tobi: ${verdict.sources.map((s) => s.source.toUpperCase()).join(' + ')} (auto, ${new Date(now).toISOString().slice(0, 10)})`,
          verifiedAt: new Date(now).toISOString().slice(0, 10),
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

  if (!acted) console.log('Nichts zu tun — kein Rennen mit frischen Ergebnissen (alle fertig oder noch nicht gelaufen).');
  else if (!write) console.log('Dry run — nichts geschrieben. `--write` schreibt raceResults.json (+ Supabase, wenn SERVICE_ROLE).');
  else if (!sb) console.log('Write ohne Secret: nur raceResults.json angefasst. DB-Push/Log brauchen SUPABASE_SERVICE_ROLE_KEY.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
