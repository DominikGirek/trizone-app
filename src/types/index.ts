// Core domain types for TriZone.

export type Discipline = 'swim' | 'bike' | 'run';

export type RaceFormat =
  | 'sprint'
  | 'olympic'
  | 'middle' // 70.3
  | 'long' // full distance
  | 'mixed_relay';

export type SeriesId = 'wtcs' | 'ironman' | 'ironman703' | 'challenge' | 'pto' | 't100' | 'other';

export type Gender = 'men' | 'women';

/** A news headline aggregated from an RSS feed. */
export interface Article {
  id: string;
  title: string;
  summary: string;
  imageUrl?: string;
  source: string;
  link: string;
  publishedAt: string; // ISO date
  lang?: 'de' | 'en';
  thumbsUp?: number; // server-fed aggregate (backend, Phase B)
  thumbsDown?: number; // server-fed aggregate (backend, Phase B)
}

export interface AthleteLinks {
  instagram?: string; // full URL
  youtube?: string;
  website?: string;
  podcast?: string;
  strava?: string;
}

export interface AthleteStart {
  date: string; // ISO (YYYY-MM-DD)
  event: string;
  series?: SeriesId;
  location?: string;
  url?: string;
  /** confirmed = on an official/media start list; expected = announced (news). */
  confidence?: 'confirmed' | 'expected';
}

export interface Athlete {
  id: string;
  name: string;
  country: string; // ISO-2 code, e.g. "DE"
  gender: Gender;
  series: SeriesId[];
  photoUrl?: string;
  bio?: string;
  upcomingStarts?: AthleteStart[];
  // Curated profile facts — all optional, all from verifiable public sources.
  // Never fabricated; missing fields are simply hidden in the UI.
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  residence?: string;
  achievements?: string[];
  links?: AthleteLinks;
}

/** A scheduled or finished race in the calendar. */
export interface Race {
  id: string;
  name: string;
  series: SeriesId;
  format: RaceFormat;
  location: string;
  country: string; // ISO-2
  date: string; // ISO date (start)
  status: 'upcoming' | 'live' | 'finished';
  hasResults: boolean;
  lat?: number;
  lon?: number;
}

/** One athlete's finishing line in a race. */
export interface RaceResult {
  position: number;
  athleteId: string;
  athleteName: string;
  country: string;
  totalTime: string; // e.g. "1:42:33"
  splits?: Partial<Record<Discipline, string>>;
  dnf?: boolean;
}

/** One row of a season-long ranking / standings table. */
export interface RankingEntry {
  rank: number;
  athleteId: string;
  athleteName: string;
  country: string;
  points: number;
  movement?: number; // change vs previous ranking (+/-)
}

export interface RankingTable {
  series: SeriesId;
  gender: Gender;
  season: string;
  entries: RankingEntry[];
  updatedAt?: string; // ISO date the source published this ranking
  source?: string; // human-readable data source label
}

/** A timing/results provider behind a local event. */
export type TimingProvider = 'raceresult' | 'racepedia' | 'other';

/** One distance option offered at a local event (km). */
export interface DistanceOption {
  label: string;
  swim?: number; // km
  bike?: number; // km
  run?: number; // km
}

/**
 * A local / regional grassroots event (the broad age-group audience).
 * Distinct from the pro `Race`: curated, geo-located, with deep links to the
 * organizer's registration and the timing provider's live/results pages.
 */
export interface LocalEvent {
  id: string;
  name: string;
  town: string;
  region: string; // e.g. "NRW"
  country: string; // ISO-2
  lat: number;
  lon: number;
  date: string; // ISO
  status: 'upcoming' | 'live' | 'finished';
  distances: DistanceOption[];
  organizer?: string;
  websiteUrl?: string;
  registrationUrl?: string;
  resultsUrl?: string;
  liveUrl?: string;
  provider?: TimingProvider;
  /** RACE RESULT event id → enables the native live ticker (/live/[eventId]). */
  raceresultEventId?: string;
  /** Branded series label for big events (e.g. "IRONMAN", "Challenge", "T100"). */
  series?: string;
  /** Official PRO start-list / pro-field URL. Set ONLY for races that actually have a pro
   *  field (IRONMAN Pro Series, full-distance IRONMAN, T100 …). Drives whether the
   *  "Profi-Starterliste" action shows and where it deep-links. Regional age-group races
   *  (e.g. a small IRONMAN 70.3) leave this unset → no pro start-list button. */
  proStartListUrl?: string;
}

/** A single line in a race-day Briefing (a schedule entry, side-event, fan zone or watch option). */
export interface BriefingItem {
  label: string; // e.g. "Start", "Helaba NightRun"
  place?: string; // e.g. "Langener Waldsee"
  time?: string; // free text, e.g. "06:20", "~11:15", "Do 19:00", "ab 06:10"
  mapsUrl?: string; // a map deep-link (fan zones / venues)
  url?: string; // an external link (e.g. where to watch live)
}

export interface BriefingSection {
  title: string; // e.g. "Das Rennen", "Side-Events", "Fan-Zonen", "Live verfolgen"
  items: BriefingItem[];
}

/** A curated, race-day "Fan-Guide" shown as the Race Center "Briefing" tab. Created only for
 *  flagship races and ONLY from verified sources — volatile race-day figures carry a dated source
 *  line (`updated` + `source`) and may change, so it stays honest. Never fabricated. */
export interface RaceBriefing {
  raceId: string; // matches the race/event id
  note?: string; // status caveat, e.g. "Wegen Hitze verkürzt: 3,8 / 125 / 21 km"
  source: string; // provenance, e.g. "tri-mag · IRONMAN"
  updated: string; // ISO date the figures were last verified (→ "Stand DD.MM.")
  hashtag?: string;
  presentedBy?: string; // sponsor, e.g. "Mainova"
  sections: BriefingSection[];
}

/** A favoritable entity reference. */
export type FavoriteKind = 'athlete' | 'series' | 'brand';
export interface Favorite {
  kind: FavoriteKind;
  id: string;
}
