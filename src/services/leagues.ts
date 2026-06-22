import teamIndexData from '@/data/teamIndex.json';
import { eventStatusFromDate } from '@/lib/format';

/**
 * German triathlon leagues from multiple sources, unified for the leagues
 * dashboard so the user can find *every* league:
 *  - LIVE (it4sport): native table + fixtures rendered in-app. The DTU portal
 *    (public token, CORS `*`) exposes 1./2. Bundesliga, Regionalliga Nord,
 *    SHTU-Landesliga, … discovered dynamically.
 *  - LINK: leagues whose data lives behind a state association's own system
 *    (NRW, Bayern, Baden-Württemberg, Regionalliga Ost/Mitte/Süd, …) that we
 *    can't read natively (gated tokens / JS-only). These still appear in the
 *    dashboard and deep-link to their official standings page — no fabricated
 *    data. Each can later be upgraded LINK → LIVE without any UI change.
 */

const DTU = {
  api: 'https://dtu.it4sport.de/api/league/widget/table',
  token: '1C8D23A0-7634-4F99-B883-79AD72177324',
};

export interface LeagueEntry {
  id: string;
  name: string;
  short: string;
  group: string;
  live: boolean;
  divisionGuid?: string; // live (it4sport uDivision)
  url?: string; // link (official standings page)
}

function groupOf(name: string): string {
  if (/1\.\s*(Triathlon\s*)?Bundesliga/i.test(name)) return '1. Bundesliga';
  if (/2\.\s*Bundesliga/i.test(name)) return '2. Bundesliga';
  if (/Regionalliga/i.test(name)) return 'Regionalliga';
  if (/Landesliga/i.test(name)) return 'Landesliga';
  return 'Weitere';
}

function shortLabel(name: string): string {
  return name
    .replace(/Triathlon\s+/gi, '')
    .replace(/Bundesliga/gi, 'BL')
    .replace(/Regionalliga/gi, 'RL')
    .replace(/Landesliga/gi, 'LL')
    .replace(/\s+/g, ' ')
    .trim();
}

// LINK leagues: official standings pages of associations we can't read natively.
const LINK_LEAGUES: LeagueEntry[] = [
  // Nordrhein-Westfalen (eigenes it4sport-Portal, Token nicht öffentlich)
  { id: 'nrw-rl-m', name: '1. Regionalliga NRW Männer', short: 'RL NRW M', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/1-regionalliga-nrw-maenner' },
  { id: 'nrw-liga-m', name: 'NRW-Liga Männer', short: 'NRW-Liga M', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/nrw-liga-maenner' },
  { id: 'nrw-liga-f', name: 'NRW-Liga Frauen', short: 'NRW-Liga F', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/nrw-liga-frauen' },
  { id: 'nrw-oberliga-m', name: 'Oberliga Männer', short: 'Oberliga M', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/oberliga-maenner' },
  { id: 'nrw-vl-nord', name: 'Verbandsliga Nord', short: 'VL Nord', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/verbandsliga-nord' },
  { id: 'nrw-vl-mitte', name: 'Verbandsliga Mitte', short: 'VL Mitte', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/verbandsliga-mitte' },
  { id: 'nrw-vl-sued', name: 'Verbandsliga Süd', short: 'VL Süd', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen/verbandsliga-sued' },
  { id: 'nrw-all', name: 'Alle NRW-Ligen', short: 'NRW · alle', group: 'Nordrhein-Westfalen', live: false, url: 'https://www.triathlonnrw.de/sport/liga/ligen' },
  // Bayern (eigenes System)
  { id: 'by-liga', name: 'Triathlon Liga Bayern (Bayernliga, Landes-, Bezirksligen)', short: 'Bayern', group: 'Bayern', live: false, url: 'https://triathlonbayern.de/liga/' },
  // Baden-Württemberg (ALB-GOLD, Racepedia)
  { id: 'bw-liga', name: 'BWTV Triathlonliga (1. Liga, Frauen, Mixed, Landesliga)', short: 'BW · Liga', group: 'Baden-Württemberg', live: false, url: 'https://baden-wuerttembergischer-triathlonverband.de/triathlonliga/bwtv-triathlonliga/' },
  // Hessen
  { id: 'he-liga', name: 'Hessenliga', short: 'Hessen', group: 'Hessen', live: false, url: 'https://hessischer-triathlon-verband.de/liga/' },
  // Regionalligen-Übersicht (Ost / Mitte / Süd / NRW / BW / Bayern)
  { id: 'rl-overview', name: 'Regionalligen-Übersicht (Ost, Mitte, Süd …)', short: 'RL · Übersicht', group: 'Regionalliga', live: false, url: 'https://www.triathlonbundesliga.de/regionalliga-0' },
];

async function fetchDtuDivisions(): Promise<LeagueEntry[]> {
  const year = new Date().getFullYear();
  const res = await fetch(`${DTU.api}?X-Auth-Token=${DTU.token}&year=${year}`);
  if (!res.ok) return [];
  const d = await res.json();
  const divisions: Record<string, string> = d.divisions ?? {};
  return Object.entries(divisions)
    .filter(([, name]) => /liga/i.test(name))
    .map(([guid, name]) => ({
      id: `dtu:${guid}`,
      name,
      short: shortLabel(name),
      group: groupOf(name),
      live: true,
      divisionGuid: guid,
    }));
}

/** All German leagues from every source, ready for a grouped dashboard list. */
export async function getAllLeagues(): Promise<LeagueEntry[]> {
  let live: LeagueEntry[] = [];
  try {
    live = await fetchDtuDivisions();
  } catch {
    // ignore — link leagues still provide coverage
  }
  return [...live, ...LINK_LEAGUES];
}

// --- Team → league index (bundled snapshot from scripts/ingest-teams.mjs) ---
// Lets the leagues search match a TEAM/town (e.g. "Bonn") and surface every
// readable league that team competes in. Coverage = live it4sport leagues only.

interface TeamIndex {
  generatedAt: string;
  leagues: { id: string; divisionGuid: string; name: string; teams: string[] }[];
}

const TEAM_INDEX = teamIndexData as TeamIndex;

/** Map of divisionGuid → first matching team name, for the given query. */
export function leaguesMatchingTeam(query: string): Map<string, string> {
  const out = new Map<string, string>();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return out;
  for (const l of TEAM_INDEX.leagues) {
    const hit = l.teams.find((tm) => tm.toLowerCase().includes(q));
    if (hit) out.set(l.divisionGuid, hit);
  }
  return out;
}

// --- Live league detail (DTU it4sport) ---

export interface LeagueTeam {
  place: string;
  team: string;
  points: number;
}

export interface LeagueFixture {
  name: string;
  city: string;
  date: string;
  status: 'upcoming' | 'live' | 'finished';
}

export interface LeagueTable {
  name: string;
  season: string;
  teams: LeagueTeam[];
  fixtures: LeagueFixture[];
}

export async function getLeagueTable(divisionGuid: string): Promise<LeagueTable> {
  const year = new Date().getFullYear();
  const res = await fetch(`${DTU.api}?X-Auth-Token=${DTU.token}&year=${year}&uDivision=${divisionGuid}`);
  if (!res.ok) throw new Error(`league table ${res.status}`);
  const d = await res.json();

  const teams: LeagueTeam[] = (Array.isArray(d.table) ? d.table : []).map((t: any) => ({
    place: String(t.place ?? ''),
    team: String(t.MSName ?? '—'),
    points: Number(t.points ?? 0),
  }));

  const fixtures: LeagueFixture[] = (d.events ?? []).map((e: any) => ({
    name: String(e.name ?? ''),
    city: String(e.city ?? ''),
    date: String(e.start ?? ''),
    status: eventStatusFromDate(String(e.start ?? '')),
  }));

  return {
    name: d.selectedDivision?.StaffelBez ?? d.selectedDivision?.league?.LigaName ?? '',
    season: String(d.season ?? `Saison ${year}`),
    teams,
    fixtures,
  };
}
