/**
 * Tobi · Slice 1–2 proof — OFFLINE. No network, no secrets, no prod writes.
 *
 * Runs the PTO + MIKA adapters + core against saved Roth-2026 fixtures and asserts the whole safety
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

import { mikaAdapter } from './adapters/mika.mjs';
import { parsePto, ptoAdapter } from './adapters/pto.mjs';
import { buildCanonicalIndex, resolveCanonical } from './canonical.mjs';
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

  console.log('Tobi · Slice 1–2 offline proof (Roth 2026 fixtures)\n');

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

  // 6 — canonical resolver (Slice 2): transliteration auto-resolves; a genuine spelling diff needs an alias
  console.log('\nCanonical resolver (Slice 2):');
  const byNorm = buildCanonicalIndex(roster.canonical);
  const rc = (raw, al = {}) => resolveCanonical(raw, { aliases: al, canonical: roster.canonical, byNorm });
  const loev = rc('solveig-loevseth');
  check("'solveig-loevseth' auto-resolves (normalized) → solveig-lovseth", loev.how === 'normalized' && loev.slug === 'solveig-lovseth');
  const graes = rc('katrine-graesboell-christensen');
  check("'katrine-graesboell-christensen' → …graesboll… (normalized)", graes.how === 'normalized' && graes.slug === 'katrine-graesboll-christensen');
  check("'carolin-pohle' is UNKNOWN without an alias (genuine spelling diff, not a rule)", rc('carolin-pohle').how === 'unknown');
  const pohle = rc('carolin-pohle', aliasesJson);
  check("'carolin-pohle' resolves via alias when mapped → caroline-pohle", pohle.how === 'alias' && pohle.slug === 'caroline-pohle');
  check('a non-athlete slug stays unknown (no false auto-match)', rc('this-athlete-does-not-exist').how === 'unknown');

  // 7 — MIKA adapter + REAL cross-source auto-publish (Slice 2), offline against both fixtures
  console.log('\nMIKA adapter + real PTO×MIKA cross-source (Slice 2):');
  const mikaSrc = await mikaAdapter(
    { base: 'fixture://roth', event: 'P' },
    {
      fixture: {
        men: resolve(HERE, 'fixtures/se-ch-roth.mika.men.html'),
        women: resolve(HERE, 'fixtures/se-ch-roth.mika.women.html'),
      },
    },
  );
  check('MIKA men == verified', eq(mikaSrc.men, VERIFIED.men));
  check('MIKA women == verified (MIKA already spells Caroline)', eq(mikaSrc.women, VERIFIED.women));
  const cross = evaluate(
    { raceId: 'se-ch-roth', genders: ['men', 'women'], sources: [src, mikaSrc] },
    { aliases: aliasesJson, roster, minSources: 2 },
  );
  check("two REAL independent sources agree ⇒ status 'publish'", cross.status === 'publish');
  check('published men == verified', eq(cross.result.men, VERIFIED.men));
  check('published women == verified', eq(cross.result.women, VERIFIED.women));

  // 8 — temporal-stability gate (auto-discovery hybrid): a single source publishes only once STABLE
  console.log('\nTemporal-stability gate (single-source hybrid):');
  const NOW = Date.parse('2026-07-06T12:00:00Z');
  const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
  const evalStab = (previousRun) =>
    evaluate(
      { raceId: 'se-ch-roth', genders: ['men', 'women'], sources: [src] },
      { aliases: aliasesJson, roster, minSources: 2, previousRun, now: NOW },
    );
  check('single source, no previous run → stage', evalStab(null).status === 'stage');
  check(
    'single source, matching previous ≥45min ago → PUBLISH (stable/final)',
    evalStab({ men: VERIFIED.men, women: VERIFIED.women, ran_at: iso(60 * 60 * 1000) }).status === 'publish',
  );
  check(
    'single source, matching previous but only 10min ago → stage (not old enough)',
    evalStab({ men: VERIFIED.men, women: VERIFIED.women, ran_at: iso(10 * 60 * 1000) }).status === 'stage',
  );
  check(
    'single source, NON-matching previous → stage (result changed)',
    evalStab({ men: [...VERIFIED.men].reverse(), women: VERIFIED.women, ran_at: iso(60 * 60 * 1000) }).status === 'stage',
  );

  console.log(`\n${failures ? `✗ ${failures} assertion(s) FAILED` : '✓ all assertions passed — Slices 1–2 + auto-discovery proven'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
