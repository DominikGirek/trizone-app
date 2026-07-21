/**
 * Tobi · run — for each configured race: run its adapters, evaluate, and report a verdict + `robot_runs` row.
 *
 * DEFAULT IS A DRY RUN — no prod writes, no secrets. It prints, per race, what Tobi WOULD do:
 * publish / stage / fail, plus the exact result it reconstructed. Slice 3 adds `--write` (raceResults.json)
 * and the Supabase push (`race_results` + `robot_runs`) behind the SERVICE_ROLE secret.
 *
 * Usage:
 *   node scripts/tobi/run.mjs                     # all configured races, live fetch, dry run
 *   node scripts/tobi/run.mjs --race=se-ch-roth   # a single race
 *   node scripts/tobi/run.mjs --min-sources=1     # (debug) lower the auto-publish bar
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mikaAdapter } from './adapters/mika.mjs';
import { ptoAdapter } from './adapters/pto.mjs';
import { evaluate } from './core.mjs';
import { loadRoster } from './roster.mjs';
import { TOBI_RACES, getTobiRace } from './races.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];

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
  const minSources = Number(arg('min-sources')) || 2;
  const races = only ? [getTobiRace(only)].filter(Boolean) : TOBI_RACES;
  if (!races.length) {
    console.error(only ? `Unknown race: ${only}` : 'No races configured.');
    process.exit(1);
  }

  const [roster, aliases] = await Promise.all([loadRoster(), loadAliases()]);
  console.log(`Tobi (dry run) · ${roster.canonical.size} canonical / ${roster.known.size} known slugs · ${races.length} race(s) · min-sources ${minSources}\n`);

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
    console.log('');
  }

  console.log('Dry run — nichts geschrieben. Prod-Write + Supabase kommen in Slice 3 (--write, hinter SERVICE_ROLE).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
