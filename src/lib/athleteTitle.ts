import type { Athlete, SeriesId } from '@/types';

/**
 * A short, punchy "epithet" for an athlete — the kind of line you'd screenshot ("T100- &
 * Mitteldistanz-Star"). Hybrid by design:
 *   1. a hand-curated title for marquee names (best wit, always true), then
 *   2. a rule-based fallback derived ONLY from verifiable data (the series they race + the
 *      curated achievements). Never fabricates a fact — "Star/Spezialist/Ass" are flavour,
 *      not claims; champion wording is gated on a real achievement entry.
 */

// Marquee athletes — witty but accurate. Keep these true; they're the most-viewed profiles.
const CURATED: Record<string, string> = {
  'jan-frodeno': 'Triathlon-Ikone',
  'patrick-lange': 'Kona-Bezwinger',
  'kristian-blummenfelt': 'Vollgas aus Norwegen',
  'gustav-iden': 'Norwegens Feingeist',
  'frederic-funk': 'T100- & Mitteldistanz-Star',
  'laura-philipp': 'Langdistanz-Weltmeisterin',
  'anne-haug': 'Langdistanz-Legende',
  'sebastian-kienle': 'Triathlon-Urgestein',
  'jonas-schomburg': 'Langdistanz-Shootingstar',
  'rico-bogen': 'Mitteldistanz-Wunderkind',
  'magnus-ditlev': 'Der dänische Diesel',
  'sam-laidlow': 'Französischer Draufgänger',
  'cassandre-beaugrand': 'Kurzdistanz-Rakete',
};

// Distance "DNA" each series stands for, in the athlete-facing wording we already use.
const LABEL: Partial<Record<SeriesId, string>> = {
  t100: 'T100',
  pto: 'T100',
  wtcs: 'Kurzdistanz',
  ironman: 'Langdistanz',
  challenge: 'Langdistanz',
  ironman703: 'Mitteldistanz',
};

// Which series headline an athlete first (T100 is the most distinctive, Mitteldistanz the
// most generic) — so a multi-series athlete leads with their most identifying discipline.
const FEATURE_ORDER: Record<string, number> = {
  t100: 0,
  pto: 0,
  wtcs: 1,
  ironman: 2,
  challenge: 2,
  ironman703: 3,
  other: 9,
};

const isChampion = (a: Athlete) =>
  (a.achievements ?? []).some((x) => /Weltmeister|Olympiasieger|Olympiasiegerin|World Champ/i.test(x));

export function athleteTitle(a: Athlete): string {
  if (CURATED[a.id]) return CURATED[a.id];

  const labels = [...(a.series ?? [])]
    .sort((x, y) => (FEATURE_ORDER[x] ?? 9) - (FEATURE_ORDER[y] ?? 9))
    .map((s) => LABEL[s])
    .filter((l): l is string => !!l);
  const distinct = [...new Set(labels)];
  const champ = isChampion(a);

  if (distinct.length === 0) return champ ? 'Weltklasse-Profi' : 'Profi-Triathlet:in';
  if (distinct.length === 1) return `${distinct[0]}-${champ ? 'Weltklasse' : 'Spezialist'}`;
  const noun = champ ? 'Ass' : distinct.length >= 3 ? 'Allrounder' : 'Star';
  return `${distinct[0]}- & ${distinct[1]}-${noun}`;
}
