import { fetchWithTimeout } from '@/lib/fetchTimeout';
import type { Athlete, Gender, Race, RankingEntry, SeriesId } from '@/types';

/**
 * World Triathlon API client (https://api.triathlon.org/v1).
 *
 * Auth is via an `apikey` header. We default to the key published in World
 * Triathlon's own public OpenAPI docs so the app works out of the box, but a
 * production app should register its own key and set EXPO_PUBLIC_WT_API_KEY.
 * See: https://developers.triathlon.org/docs/register-and-manage-your-app
 */
const BASE = 'https://api.triathlon.org/v1';
const DEFAULT_PUBLIC_KEY = '2649776ef9ece4c391003b521cbfce7a';
const API_KEY = process.env.EXPO_PUBLIC_WT_API_KEY || DEFAULT_PUBLIC_KEY;

/** WTCS = category 351; ranking ids 15 (men) / 16 (women). */
const WTCS_CATEGORY = 351;
const WTCS_RANKING: Record<Gender, number> = { men: 15, women: 16 };

async function wtFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetchWithTimeout(
    `${BASE}${path}${qs ? `?${qs}` : ''}`,
    { headers: { apikey: API_KEY, Accept: 'application/json' } },
    7000,
  );
  if (!res.ok) throw new Error(`WT API ${path} → ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface WTEvent {
  event_id: number;
  event_title: string;
  event_venue: string;
  event_country_isoa2: string;
  event_date: string;
  event_finish_date: string;
  event_status: string;
  event_latitude?: number | string;
  event_longitude?: number | string;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

function seriesFromTitle(title: string): SeriesId {
  if (/championship series|\bWTCS\b/i.test(title)) return 'wtcs';
  return 'other';
}

function statusFor(start: string, finish: string): Race['status'] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const s = new Date(start);
  const f = new Date(finish || start);
  if (f < now) return 'finished';
  if (s <= now && now <= f) return 'live';
  return 'upcoming';
}

function mapEvent(e: WTEvent): Race {
  const name = e.event_title.replace(/^\d{4}\s+/, ''); // drop leading year
  return {
    id: String(e.event_id),
    name,
    series: seriesFromTitle(e.event_title),
    format: 'olympic',
    location: e.event_venue || '',
    country: (e.event_country_isoa2 || '').toUpperCase(),
    date: new Date(`${e.event_date}T09:00:00`).toISOString(),
    status: statusFor(e.event_date, e.event_finish_date),
    hasResults: false, // real results not yet wired; see roadmap
    lat: num(e.event_latitude),
    lon: num(e.event_longitude),
  };
}

/** Real WTCS events: past 12 months (for the "Vergangene" tab) + upcoming window. */
export async function fetchWtcsEvents(): Promise<Race[]> {
  const data = await wtFetch<WTEvent[]>('/events', {
    category_id: WTCS_CATEGORY,
    start_date: ymd(-365),
    end_date: ymd(160),
    per_page: 100,
  });
  return (data ?? [])
    .filter((e) => e.event_status !== 'cancelled')
    .map(mapEvent)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

interface WTRankingEntry {
  rank: number;
  last_rank?: number;
  total: number;
  athlete_id: number;
  athlete_full_name?: string;
  athlete_title?: string;
  athlete_country_isoa2?: string;
  athlete_noc?: string;
}

function mapRankingEntry(e: WTRankingEntry): RankingEntry {
  const movement = e.last_rank && e.last_rank > 0 ? e.last_rank - e.rank : 0;
  return {
    rank: e.rank,
    athleteId: String(e.athlete_id),
    athleteName: e.athlete_full_name || e.athlete_title || '—',
    country: (e.athlete_country_isoa2 || e.athlete_noc || '').toUpperCase(),
    points: Math.round(e.total),
    movement,
  };
}

/** Real WTCS ranking for the given gender, plus the date it was published. */
export async function fetchWtcsRanking(
  gender: Gender,
): Promise<{ entries: RankingEntry[]; published?: string }> {
  const data = await wtFetch<{ rankings: WTRankingEntry[]; published?: string }>(
    `/rankings/${WTCS_RANKING[gender]}`,
    { limit: 50 },
  );
  const published = data?.published
    ? new Date(data.published.replace(' ', 'T') + 'Z').toISOString()
    : undefined;
  return { entries: (data?.rankings ?? []).map(mapRankingEntry), published };
}

interface WTAthlete {
  athlete_id: number;
  athlete_full_name?: string;
  athlete_title?: string;
  athlete_gender?: string;
  athlete_country_isoa2?: string;
  athlete_noc?: string;
  athlete_country_name?: string;
  athlete_profile_image?: string;
  athlete_yob?: number;
}

/** Real athlete profile by World Triathlon id. */
export async function fetchWtAthlete(id: string): Promise<Athlete | undefined> {
  const d = await wtFetch<WTAthlete>(`/athletes/${id}`);
  if (!d) return undefined;
  return {
    id: String(d.athlete_id),
    name: d.athlete_full_name || d.athlete_title || '—',
    country: (d.athlete_country_isoa2 || d.athlete_noc || '').toUpperCase(),
    gender: d.athlete_gender === 'female' ? 'women' : 'men',
    series: ['wtcs'],
    photoUrl: d.athlete_profile_image,
    bio: d.athlete_country_name
      ? `${d.athlete_country_name}${d.athlete_yob ? ` · ${d.athlete_yob}` : ''}`
      : undefined,
  };
}
