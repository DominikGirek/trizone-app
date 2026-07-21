/**
 * Tobi · race config — which tippable races Tobi handles, and which adapter refs feed each.
 *
 *  • raceId  — the app race id (matches predictions.race_id AND raceResults.raceId one-to-one).
 *  • genders — which podiums this race edition actually scores (some 2026 championships were single-gender).
 *  • pto     — the protriathletes.org race ref { slug, year } for the PTO adapter.
 *
 * Slice 1 wires the PTO adapter only. More adapters (MIKA, IRONMAN, World-Triathlon) get added here as
 * extra refs in Slice 2 — that's what lets the confidence gate reach ≥2 agreeing sources and auto-publish.
 */
export const TOBI_RACES = [
  { raceId: 'se-ch-roth', genders: ['men', 'women'], pto: { slug: 'challenge-roth', year: 2026 } },
  { raceId: 'se-im-frankfurt', genders: ['men'], pto: { slug: 'im-germany', year: 2026 } },
  { raceId: 'se-im-hamburg', genders: ['women'], pto: { slug: 'im-hamburg', year: 2026 } },
  { raceId: 'se-t100-singapore', genders: ['men'], pto: { slug: 'singapore-t100', year: 2026 } },
];

/** @returns {typeof TOBI_RACES[number] | undefined} */
export function getTobiRace(raceId) {
  return TOBI_RACES.find((r) => r.raceId === raceId);
}
