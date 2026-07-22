/**
 * Tobi · run — self-discovering results robot. Iterates the tippable-race registry (raceMap.json), skips
 * races already fully published, fetches each race's sources (PTO always; MIKA where configured), and —
 * in --write mode — publishes when the confidence gate clears (≥2 sources agree, OR a single source is
 * stable across two runs ≥~45 min apart). Fully hands-off: no per-race dates for scoring, no manual triggers.
 *
 * OVERDUE ALARM (anti-silent-failure): every registry race carries its expected `date`. If a race is well
 * past it with STILL no result, Tobi logs a visible `robot_runs` flag instead of skipping silently — so a
 * missing/wrong PTO slug or a race PTO didn't publish becomes a ping, not a quiet miss.
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
import { isOverdue, overdueHours, sameRun } from './overdue.mjs';
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
  const overdueH = Number(arg('overdue-h')) || 36;
  const now = arg('now') ? Date.parse(arg('now')) : Date.now(); // --now=ISO overrides the clock (testing)

  let races = only ? [await getTobiRace(only)].filter(Boolean) : await loadTobiRaces();
  if (only && !races.length) {
    console.error(`Unknown race: ${only}`);
    process.exit(1);
  }

  const [roster, aliases, published] = await Promise.all([loadRoster(), loadAliases(), loadPublished()]);
  const sb = write ? await getSupabase() : null;
  const mode = write ? (sb ? 'WRITE + Supabase' : 'WRITE (no SERVICE_ROLE → JSON only)') : 'dry run';
  console.log(`Tobi (${mode}) · ${roster.canonical.size} canonical slugs · ${races.length} race(s) · min-sources ${minSources}\n`);

  // Log a robot_runs row unless it's identical to the last (dedup → one row per state; keeps the stability
  // clock anchored to first sighting). Returns whether it logged.
  const logDeduped = async (last, run) => {
    if (!sb || sameRun(last, run)) return false;
    try {
      await logRun(sb, run);
      return true;
    } catch (e) {
      console.error(`     robot_runs: ${e.message}`);
      return false;
    }
  };

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
    const last = sb ? await fetchLastRun(sb, race.raceId) : null;

    if (!sourcesHaveData(sources)) {
      // No finishers anywhere. Either the race hasn't happened → skip silently, or it's well past its date
      // and STILL empty → an OVERDUE alarm (missing/wrong slug, or PTO never published).
      if (isOverdue(race.date, now, overdueH)) {
        const hrs = Math.round(overdueHours(race.date, now));
        const run = {
          robot: 'tobi',
          race_id: race.raceId,
          status: 'stage',
          confidence: 0,
          men: [],
          women: [],
          source_count: 0,
          unknown_slugs: [],
          note: `ÜBERFÄLLIG: kein Ergebnis nach Rennen (${race.date}) — PTO-Slug/Quelle prüfen`,
        };
        console.log(`🔴 ÜBERFÄLLIG  ${race.raceId}  — ${hrs} h nach Rennen (${race.date}), keine Quelle liefert Ergebnisse`);
        if (write) await logDeduped(last, run);
        console.log('');
        acted++;
      }
      continue;
    }

    const verdict = evaluate(
      { raceId: race.raceId, genders: race.genders, sources },
      { aliases, roster, minSources, previousRun: last, now },
    );
    acted++;

    console.log(`${ICON[verdict.status]}  ${race.raceId}  — ${verdict.reason}`);
    for (const g of race.genders) console.log(`     ${g}: ${(verdict.result[g] || []).join(', ') || '—'}`);
    if (verdict.unknownSlugs.length) {
      console.log(`     ⚠ unbekannt: ${verdict.unknownSlugs.map((u) => `${u.slug} (${u.gender})`).join(', ')} → Alias in aliases.json`);
    }

    if (write) {
      await logDeduped(last, verdict.run);
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
  else if (!sb) console.log('Write ohne Secret: nur raceResults.json angefasst. DB-Push/Log/Alarm brauchen SUPABASE_SERVICE_ROLE_KEY.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
