import type { Athlete } from '@/types';

// Rough global-recognition ranking of current pro triathletes (most → least known). Used to
// surface the headliners first in start-list previews — so "Profis am Start" shows the names
// people actually recognise, not whoever happens to come first alphabetically. Hand-kept;
// missing names just score 0 and fall back to achievements/bio + alphabetical order.
const FAMOUS = [
  // men
  'Kristian Blummenfelt', 'Gustav Iden', 'Magnus Ditlev', 'Sam Laidlow', 'Patrick Lange',
  'Léo Bergère', 'Hayden Wilde', 'Casper Stornes', 'Jelle Geens', 'Vincent Luis', 'Matthew Hauser',
  'Lionel Sanders', 'Frederic Funk', 'Rico Bogen', 'Daniel Bækkegård', 'Kyle Smith', 'Jan Frodeno',
  'Sebastian Kienle', 'Jonas Schomburg', 'Rudy Von Berg', 'Braden Currie', 'Ben Kanute',
  'Mathis Margirier', 'Mika Noodt', 'Joe Skipper', 'Trevor Foley',
  // women
  'Taylor Knibb', 'Lucy Charles-Barclay', 'Anne Haug', 'Laura Philipp', 'Kat Matthews',
  'Ashleigh Gentle', 'Cassandre Beaugrand', 'Flora Duffy', 'Julie Derron', 'Beth Potter',
  'Paula Findlay', 'Imogen Simmonds', 'India Lee', 'Daniela Ryf', 'Holly Lawrence',
  'Emma Pallant-Browne',
];

const nameKey = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const RANK = new Map<string, number>(FAMOUS.map((n, i) => [nameKey(n), FAMOUS.length - i]));

/** Higher = more recognisable. Famous-list membership dominates; curated achievements / bio
 *  break ties among the rest. */
export function fameScore(a: Athlete): number {
  const base = RANK.get(nameKey(a.name)) ?? 0;
  const bonus = (a.achievements?.length ? 5 : 0) + (a.bio ? 2 : 0);
  return base * 10 + bonus;
}
