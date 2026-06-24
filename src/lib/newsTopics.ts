import { brandsById } from '@/lib/brands';
import type { Article } from '@/types';

/**
 * Lightweight, on-device interest classification for news.
 * Articles are tagged by scanning title + summary for topic keywords (DE + EN),
 * and ranked for the "For you" feed against the user's favorite series and
 * athletes. No network, no fabrication — purely derived from the real headline.
 */
export type NewsTopic = 'pro' | 'long' | 'agegroup' | 'training' | 'gear';

export const NEWS_TOPICS: NewsTopic[] = ['pro', 'long', 'agegroup', 'training', 'gear'];

export const TOPIC_ICON: Record<NewsTopic, string> = {
  pro: '🏆',
  long: '🎽',
  agegroup: '🥇',
  training: '📚',
  gear: '🛠️',
};

const KEYWORDS: Record<NewsTopic, RegExp> = {
  pro: /\b(wtcs|world triathlon|world cup|olympi|super ?tri|championship series|draft|mixed relay|elite|profi|weltcup|blummenfelt|yee|wilde|beaugrand|knibb|taylor.?brown|duffy|frodeno|lange|philipp)\b/i,
  long: /\b(ironman|70\.?3|kona|sub ?7|sub ?8|t100|pto|challenge roth|langdistanz|long course|mitteldistanz|half distance|full distance|hawaii)\b/i,
  agegroup: /\b(age.?group|agegrouper|altersklasse|breitensport|amateur|hobby|qualif|slot|first.?timer|einsteiger|jedermann|finisher)\b/i,
  training: /\b(training|workout|ftp|vo2|threshold|schwelle|recovery|regeneration|nutrition|ern[äa]hrung|fuel|pacing|taper|technique|technik|zone ?2|trainingsplan)\b/i,
  gear: /\b(wetsuit|neopren|laufschuh|running shoe|goggle|gear|review|test|aero|helmet|helm|garmin|wahoo|smartwatch|wheel|laufrad|sattel|saddle|kaufberatung|bike check)\b/i,
};

/** Topics an article touches (may be several, or none). */
export function topicsOf(a: Article): NewsTopic[] {
  const hay = `${a.title} ${a.summary}`;
  return NEWS_TOPICS.filter((t) => KEYWORDS[t].test(hay));
}

// Favorite series id → headline keywords.
const SERIES_KEYWORDS: Record<string, RegExp> = {
  wtcs: /\b(wtcs|world triathlon|world cup|weltcup|olympi|super ?tri)\b/i,
  ironman: /\b(ironman|kona|hawaii)\b/i,
  ironman703: /\b(70\.?3|ironman 70)\b/i,
  challenge: /\b(datev )?challenge (roth|family|championship|davos|salou|gran ?canaria|sanremo|riccione|sam[oó]rin|walchsee|st[. ]*p[öo]lten|prague|turku|almere|kaiserwinkl|gdynia|geraardsbergen|fortaleza)\b/i,
  t100: /\b(t100|pto)\b/i,
  pto: /\b(pto|t100)\b/i,
};

/**
 * Interest match strength for the "For you" feed: how strongly an article
 * matches the user's favorite athletes (by name) and series. Recency is the
 * tiebreaker (applied separately in the sort), so matches always float up.
 */
export function relevanceOf(
  a: Article,
  opts: { athleteNames: string[]; seriesIds: string[]; brandIds?: string[] },
): number {
  const text = `${a.title} ${a.summary}`;
  const hay = text.toLowerCase();
  let score = 0;
  for (const name of opts.athleteNames) {
    const n = name.trim().toLowerCase();
    if (!n) continue;
    const last = n.split(/\s+/).pop()!;
    if (hay.includes(n)) score += 6;
    else if (last.length > 3 && hay.includes(last)) score += 4;
  }
  for (const s of opts.seriesIds) {
    const re = SERIES_KEYWORDS[s];
    if (re && re.test(hay)) score += 3;
  }
  for (const id of opts.brandIds ?? []) {
    const brand = brandsById[id];
    if (brand && brand.keywords.test(text)) score += 5;
  }
  return score;
}

// Small seeded PRNG (mulberry32) — deterministic given a seed, so the dashboard
// mix is stable within a render but rotates across sessions / time buckets.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Topics the user is broadly into, inferred from their explicit interests. */
export function affinityTopics(opts: {
  athleteNames: string[];
  seriesIds: string[];
  brandIds?: string[];
}): Set<NewsTopic> {
  const s = new Set<NewsTopic>();
  if (opts.athleteNames.length) s.add('pro');
  for (const id of opts.seriesIds) {
    if (id === 'wtcs') s.add('pro');
    if (id === 'ironman' || id === 'ironman703' || id === 'challenge' || id === 't100' || id === 'pto') s.add('long');
  }
  if ((opts.brandIds ?? []).length) s.add('gear');
  return s;
}

/** Recency weight: ~1 for fresh articles, decaying smoothly for older ones. */
function recencyWeight(publishedAt: string): number {
  const ageH = (Date.now() - +new Date(publishedAt)) / 3.6e6;
  if (!Number.isFinite(ageH) || ageH < 0) return 1;
  return Math.exp(-ageH / 48);
}

/**
 * Dashboard "discovery" picker — relevant but not rigid. Each article gets a
 * weight from (1) exact interest match, (2) broader topic affinity (so adjacent
 * interests surface), (3) recency, plus a small base so fresh news always has a
 * chance. We then draw `count` items via seeded weighted sampling
 * (Efraimidis–Spirakis): higher weight = more likely, but the mix changes
 * across sessions / time buckets instead of always showing the same headlines.
 * Selected items are shown freshest-first.
 */
export function pickForYou(
  articles: Article[],
  opts: { athleteNames: string[]; seriesIds: string[]; brandIds?: string[] },
  seed: number,
  count = 3,
): Article[] {
  if (articles.length <= count) return articles;
  const affinity = affinityTopics(opts);
  const rnd = mulberry32(seed);
  return articles
    .map((a) => {
      const interest = relevanceOf(a, opts);
      const topicHits = topicsOf(a).filter((t) => affinity.has(t)).length;
      const weight = interest * 3 + topicHits * 1.5 + recencyWeight(a.publishedAt) * 1.2 + 0.4;
      const key = Math.pow(rnd(), 1 / Math.max(weight, 0.001));
      return { a, key };
    })
    .sort((x, y) => y.key - x.key)
    .slice(0, count)
    .sort((x, y) => +new Date(y.a.publishedAt) - +new Date(x.a.publishedAt))
    .map((x) => x.a);
}

// Generic words that don't identify a specific race (so we match on the venue
// / distinctive tokens instead — "Roth", "Frankfurt", "Kona", "Quiberon" …).
const RACE_STOPWORDS = new Set([
  'ironman', 'challenge', 'triathlon', 'world', 'championship', 'championships', 'series',
  'european', 'powered', 'presented', 'the', 'und', 'and', 'von', 'der', 'die', 'das', 'main',
  't100', 'pto', 'wtcs', 'sprint', 'olympic', 'olympisch', 'mixed', 'relay', 'tri',
  'kids', 'schüler', 'schultriathlon', 'race', 'rennen', 'cup',
  // Common event-descriptor / dictionary words that are NOT race-identifying — without
  // these, names like "After Work Triathlon" matched any English article saying "after".
  'after', 'work', 'night', 'nacht', 'abend', 'evening', 'morning', 'classic', 'klassik',
  'festival', 'summer', 'sommer', 'winter', 'spring', 'autumn', 'herbst', 'city', 'stadt',
  'lake', 'beach', 'strand', 'park', 'open', 'women', 'woman', 'frauen', 'ladies', 'junior',
  'juniors', 'youth', 'jugend', 'masters', 'master', 'indoor', 'outdoor', 'charity',
  'memorial', 'edition', 'international', 'national', 'regional', 'club', 'team', 'results',
  'ergebnisse', 'finish', 'start', 'course', 'strecke', 'live', 'news', 'guide', 'training',
  'light', 'color', 'colour', 'family', 'familie', 'volks', 'jedermann', 'cross', 'swim',
  'bike', 'lauf', 'run', 'jump', 'over', 'event', 'days', 'weekend',
]);

/** Distinctive lowercased tokens (venue / event name) used to find a race's news. */
export function raceNewsKeywords(name: string, place?: string): string[] {
  const out = new Set<string>();
  const add = (s?: string) =>
    (s ?? '').split(/[\s,\-–/()]+/).forEach((w) => {
      const tok = w.toLowerCase().replace(/[^a-zäöüß0-9.]/g, '');
      if (tok.length >= 4 && !RACE_STOPWORDS.has(tok) && !/^\d+(\.\d+)?$/.test(tok)) out.add(tok);
    });
  add(place);
  add(name);
  return [...out];
}

/** Search query for per-race news (Google News): event name + venue. */
export function raceSearchQuery(name: string, place?: string): string {
  const n = name.trim();
  const p = (place ?? '').trim();
  return p && !n.toLowerCase().includes(p.toLowerCase()) ? `${n} ${p}` : n;
}

/** Merge curated + local-press articles, de-duplicating by normalized title. */
export function mergeRaceNews(primary: Article[], extra: Article[], limit = 8): Article[] {
  const seen = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]/g, '').slice(0, 40);
  const out: Article[] = [];
  for (const a of [...primary, ...extra]) {
    const key = norm(a.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out.slice(0, limit);
}

// A forward-looking PREVIEW (schedule, livestream, start list …) vs. a RECAP (results,
// report). A preview of a race that already happened is dead weight; a recap stays useful.
const PREVIEW_RE =
  /zeitplan|livestream|übertragung|vorschau|vorbericht|startzeit|startliste|preview|favoriten|tickets|anmeldung|countdown|so (siehst|verfolg)|live verfolg/i;
const RECAP_RE =
  /ergebnis|nachbericht|rückblick|result|recap|race report|gewinnt|gewann|sieg|siegt|champion|podium|weltmeister wird/i;

/** Drop stale PREVIEW articles about a race that has already finished (e.g. "IRONMAN
 *  Hamburg: Zeitplan, Livestream" after Hamburg). Recaps/results of past races are kept,
 *  and anything not tied to a known past race is untouched. `finishedTokens` = distinctive
 *  venue/name tokens of events that are already over. */
export function dropPastEventNews(articles: Article[], finishedTokens: Set<string>): Article[] {
  if (!finishedTokens.size) return articles;
  return articles.filter((a) => {
    const hay = `${a.title} ${a.summary}`.toLowerCase();
    const aboutPast = [...finishedTokens].some((k) => hay.includes(k));
    if (!aboutPast) return true; // not about a known past race → keep
    if (RECAP_RE.test(hay)) return true; // a recap/results of it → still relevant
    return !PREVIEW_RE.test(hay); // a preview of a race that's over → drop
  });
}

/** News articles that mention this race (by venue / distinctive name token). */
export function newsForRace(
  articles: Article[],
  name: string,
  place?: string,
  limit = 5,
): Article[] {
  const kws = raceNewsKeywords(name, place);
  if (!kws.length) return [];
  return articles
    .filter((a) => {
      const hay = `${a.title} ${a.summary}`.toLowerCase();
      return kws.some((k) => hay.includes(k));
    })
    .slice(0, limit);
}
