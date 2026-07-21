/**
 * Tobi · Slice-1 proof — OFFLINE. No network, no secrets, no prod writes.
 *
 * Runs the PTO adapter + core against the saved Roth-2026 results fixture and asserts the whole safety
 * design against the result we already verified by hand (src/data/raceResults.json → se-ch-roth):
 *
 *   1. PTO parse reconstructs the EXACT verified men's top-5.
 *   2. PTO spells the women's P5 'carolin-pohle' (≠ our roster's 'caroline-pohle') — the raw parse shows it.
 *   3. WITHOUT the alias, the core flags 'carolin-pohle' as UNKNOWN and STAGES (never invents a finisher).
 *   4. WITH the alias, women resolve to the verified top-5 — but a single source still only STAGES
 *      (auto-publish needs ≥2 agreeing sources).
 *   5. Add a 2nd agreeing source and the verdict flips to PUBLISH — the confidence gate works both ways.
 *
 * Exit non-zero on any failed assertion.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePto, ptoAdapter } from './adapters/pto.mjs';
import { evaluate } from './core.mjs';
import { loadRoster } from './roster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, 'fixtures/se-ch-roth.pto.results.html');

// Ground truth — the hand-verified Roth 2026 result (src/data/raceResults.json).
const VERIFIED = {
  men: ['sam-laidlow', 'kristian-blummenfelt', 'rico-bogen', 'menno-koolhaas', 'jonas-schomburg'],
  women: ['alanis-siffert', 'lucy-charles-barclay', 'daisy-davies', 'kat-matthews', 'caroline-pohle'],
};

let failures = 0;
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
function check(label, cond) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures++;
}

async function main() {
  const roster = await loadRoster();
  const aliasesJson = JSON.parse(await readFile(resolve(HERE, 'aliases.json'), 'utf8')).aliases || {};

  console.log('Tobi · Slice-1 offline proof (Roth 2026 fixture)\n');

  // 1 + 2 — raw parse
  const raw = parsePto(await readFile(FIXTURE, 'utf8'));
  console.log('Parse (raw PTO):');
  check(`men == verified (${raw.men.join(', ')})`, eq(raw.men, VERIFIED.men));
  check("women P5 is the PTO spelling 'carolin-pohle'", raw.women[4] === 'carolin-pohle');
  check('women[0..3] == verified', eq(raw.women.slice(0, 4), VERIFIED.women.slice(0, 4)));

  const src = await ptoAdapter({ slug: 'challenge-roth', year: 2026 }, { fixture: FIXTURE });
  const race = { raceId: 'se-ch-roth', genders: ['men', 'women'], sources: [src] };

  // 3 — WITHOUT alias → stage + flag the unknown slug
  console.log('\nCore, NO alias (single source):');
  const noAlias = evaluate(race, { aliases: {}, roster, minSources: 2 });
  check("status == 'stage'", noAlias.status === 'stage');
  check("flags 'carolin-pohle' as unknown", noAlias.unknownSlugs.some((u) => u.slug === 'carolin-pohle'));
  check('men candidate == verified (known path unaffected)', eq(noAlias.result.men, VERIFIED.men));

  // 4 — WITH alias → resolves to verified, but single source still only stages
  console.log('\nCore, WITH alias (single source):');
  const oneSrc = evaluate(race, { aliases: aliasesJson, roster, minSources: 2 });
  check('women candidate == verified (alias resolved)', eq(oneSrc.result.women, VERIFIED.women));
  check('no unknown slugs left', oneSrc.unknownSlugs.length === 0);
  check("status == 'stage' (1 source < 2)", oneSrc.status === 'stage');

  // 5 — add a 2nd agreeing source → auto-publish
  console.log('\nCore, WITH alias + 2nd agreeing source:');
  const src2 = { source: 'mika', ok: true, url: 'fixture://agree', men: VERIFIED.men, women: raw.women };
  const twoSrc = evaluate({ ...race, sources: [src, src2] }, { aliases: aliasesJson, roster, minSources: 2 });
  check("status == 'publish'", twoSrc.status === 'publish');
  check('published men == verified', eq(twoSrc.result.men, VERIFIED.men));
  check('published women == verified', eq(twoSrc.result.women, VERIFIED.women));
  check('confidence == 100', twoSrc.run.confidence === 100);

  console.log(`\n${failures ? `✗ ${failures} assertion(s) FAILED` : '✓ all assertions passed — Slice 1 proven'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
