import { mentionsAny, raceNewsKeywords } from '@/lib/newsTopics';
import type { Article } from '@/types';

/**
 * Hot-news detector (Phase B, stage 1 — in-app only, no backend yet).
 *
 * A "hot" item is a TIME-CRITICAL status change of a SPECIFIC race — the kind of thing that
 * later warrants a push. High precision by design: an impact word AND the race itself must
 * both appear in the headline TITLE, and the article must be recent. Reuses the same
 * word-boundary race matching as the cancellation logic. See [[hot-news-push]].
 */
export type HotSeverity = 'critical' | 'major' | 'minor';
export type HotCategory = 'cancelled' | 'shortened' | 'postponed' | 'delayed';
export interface HotAlert {
  severity: HotSeverity;
  category: HotCategory;
  article: Article;
}

// Curated impact lexicon (DE + EN), ordered by severity. The race-token-in-title gate below is
// what keeps this precise, so the impact patterns can stay broad.
const IMPACT: { re: RegExp; severity: HotSeverity; category: HotCategory }[] = [
  { re: /(abgesagt|abgebrochen|annulliert|cancell?ed|cancellation|evakuiert|called off)/i, severity: 'critical', category: 'cancelled' },
  { re: /(verk[üu]rzt|gek[üu]rzt|eingek[üu]rzt|shortened|distanzen? (verk[üu]rzt|reduziert))/i, severity: 'major', category: 'shortened' },
  { re: /(verlegt|verschoben|postponed|rescheduled|neuer termin|verschiebung)/i, severity: 'major', category: 'postponed' },
  { re: /(verz[öo]gert|delayed|startverschiebung|startzeit ge[äa]ndert|hitzewarnung)/i, severity: 'minor', category: 'delayed' },
];

const RANK: Record<HotSeverity, number> = { critical: 3, major: 2, minor: 1 };
const FRESH_MS = 14 * 24 * 60 * 60 * 1000;

/** The strongest race-status impact a recent headline reports for this race, or null. */
export function hotAlertFor(articles: Article[], name: string, place?: string, now = Date.now()): HotAlert | null {
  const kws = raceNewsKeywords(name, place);
  if (!kws.length) return null;
  const cutoff = now - FRESH_MS;
  let best: HotAlert | null = null;
  for (const a of articles) {
    if (+new Date(a.publishedAt) < cutoff) continue;
    if (!mentionsAny(a.title, kws)) continue; // the race itself must be named in the headline
    for (const imp of IMPACT) {
      if (!imp.re.test(a.title)) continue;
      const better =
        !best ||
        RANK[imp.severity] > RANK[best.severity] ||
        (RANK[imp.severity] === RANK[best.severity] &&
          +new Date(a.publishedAt) > +new Date(best.article.publishedAt));
      if (better) best = { severity: imp.severity, category: imp.category, article: a };
      break; // first (highest-severity) impact pattern that hits this title wins for this article
    }
  }
  return best;
}

export interface RaceRef {
  id: string;
  name: string;
  place?: string;
}

/** Scan a set of races against the news feed → the hot alerts, most severe + freshest first. */
export function hotAlerts<R extends RaceRef>(
  articles: Article[],
  races: R[],
  now = Date.now(),
): (HotAlert & { race: R })[] {
  const out: (HotAlert & { race: R })[] = [];
  const seen = new Set<string>();
  for (const r of races) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const alert = hotAlertFor(articles, r.name, r.place, now);
    if (alert) out.push({ ...alert, race: r });
  }
  return out.sort(
    (x, y) =>
      RANK[y.severity] - RANK[x.severity] ||
      +new Date(y.article.publishedAt) - +new Date(x.article.publishedAt),
  );
}
