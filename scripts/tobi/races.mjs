/**
 * Tobi · races — the races Tobi scores, loaded from raceMap.json (the tippable-race registry) and turned
 * into ready-to-run adapter refs. Self-discovering: no per-race dates, no hardcoded year — the current year
 * fills the PTO slug and the MIKA base, so a new season just works. Add a race = one line in raceMap.json.
 *
 * Each returned entry: { raceId, genders, pto:{slug,year}, mika?:{base,event} }.
 *  • genders — the edition's scored podiums (raceMap override, default both). A both-gender race won't be
 *    published half-done (see core.mjs completeness gate), so this only needs setting for single-gender editions.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** @returns {Promise<Array<{raceId:string, genders:('men'|'women')[], pto:{slug:string,year:number}, mika?:{base:string,event:string}}>>} */
export async function loadTobiRaces(year = new Date().getFullYear()) {
  const j = JSON.parse(await readFile(resolve(HERE, 'raceMap.json'), 'utf8'));
  return (j.races || []).map((r) => ({
    raceId: r.raceId,
    genders: r.genders && r.genders.length ? r.genders : ['men', 'women'],
    date: r.date, // optional — powers the overdue alarm (run.mjs); not used for scoring
    pto: { slug: r.pto, year },
    mika: r.mika ? { base: r.mika.base.replace('{year}', String(year)), event: r.mika.event } : undefined,
  }));
}

/** One configured race by app id (for `run.mjs --race=`). */
export async function getTobiRace(raceId, year) {
  return (await loadTobiRaces(year)).find((r) => r.raceId === raceId);
}
