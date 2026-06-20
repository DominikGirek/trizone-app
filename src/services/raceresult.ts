/**
 * Adapter for the public RACE RESULT results portal (my.raceresult.com).
 *
 * The published-results config endpoint is public and exposes an access `key`,
 * the contests and the available result/live lists. With that key the data/list
 * endpoint returns the actual rows. Both send `Access-Control-Allow-Origin: *`,
 * so this works on web and native without a proxy. Used for events that publish
 * results publicly via RACE RESULT (a large share of German age-group races).
 */
const BASE = (eventId: string) => `https://my.raceresult.com/${eventId}/RRPublish`;

export interface RRContest {
  id: string;
  name: string;
}

export interface RRList {
  name: string;
  contest: string;
  live: boolean;
  showAs: string;
}

export interface RRConfig {
  eventId: string;
  key: string;
  eventName: string;
  showLive: boolean;
  eventOver: boolean;
  contests: RRContest[];
  lists: RRList[];
}

export interface LiveRow {
  position?: string;
  bib?: string;
  name?: string;
  club?: string;
  ageClass?: string;
  time?: string;
  swim?: string;
  bike?: string;
  run?: string;
}

export interface LiveGroup {
  title: string;
  rows: LiveRow[];
}

export interface LiveResults {
  groups: LiveGroup[];
  liveUpdateInterval: number; // seconds, 0 = no auto refresh
}

export async function fetchRRConfig(eventId: string): Promise<RRConfig> {
  const res = await fetch(`${BASE(eventId)}/data/config?page=results&noVisitor=1`);
  if (!res.ok) throw new Error(`raceresult config ${res.status}`);
  const c = await res.json();
  const contests: RRContest[] = Object.entries(c.contests ?? {}).map(([id, name]) => ({
    id,
    name: String(name),
  }));
  const lists: RRList[] = (c.lists ?? []).map((l: any) => ({
    name: l.Name,
    contest: String(l.Contest ?? ''),
    live: !!l.Live,
    showAs: l.ShowAs ?? l.Name,
  }));
  return {
    eventId,
    key: c.key,
    eventName: c.eventname ?? '',
    showLive: !!c.showLive,
    eventOver: !!c.EventOver,
    contests,
    lists,
  };
}

/** Pick the best list for a contest (prefer a live list when the event is live). */
export function pickList(config: RRConfig, contestId: string): RRList | undefined {
  const forContest = config.lists.filter((l) => l.contest === contestId);
  if (!forContest.length) return undefined;
  if (config.showLive) {
    const live = forContest.find((l) => l.live);
    if (live) return live;
  }
  return forContest[0];
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[.\s]/g, '');

/** Map list column labels to row indices (rows are [id, bib, ...columns]). */
function columnIndex(fields: { Label: string }[]) {
  const col: Record<string, number> = {};
  let r = 2; // row[0]=internal id, row[1]=bib
  for (const f of fields) {
    const L = norm(f.Label);
    if (L === 'startnr' || L === 'bib') continue; // bib already at row[1]
    if (/^platz|^rang|^pos/.test(L) && col.position == null) col.position = r;
    else if (/^name/.test(L) && col.name == null) col.name = r;
    else if (/(gesamt|finish|netto|brutto|total|^zeit|^time)/.test(L) && col.time == null) col.time = r;
    else if (/(^ak$|klasse|^kat|categor)/.test(L) && col.ageClass == null) col.ageClass = r;
    else if (/(verein|club|team|nation|land)/.test(L) && col.club == null) col.club = r;
    else if (/(schw|swim)/.test(L) && col.swim == null) col.swim = r;
    else if (/(rad|bike|velo|cycl)/.test(L) && col.bike == null) col.bike = r;
    else if (/(lauf|run)/.test(L) && col.run == null) col.run = r;
    r++;
  }
  return col;
}

function cleanGroupTitle(k: string): string {
  return k.replace(/^#?\d+_/, '').replace(/^#/, '').trim();
}

export async function fetchRRResults(
  eventId: string,
  key: string,
  listname: string,
  contest: string,
): Promise<LiveResults> {
  const url =
    `${BASE(eventId)}/data/list?key=${key}` +
    `&listname=${encodeURIComponent(listname)}&page=results&contest=${contest}&r=all&l=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`raceresult list ${res.status}`);
  const d = await res.json();

  const col = columnIndex(d?.list?.Fields ?? []);
  const val = (row: any[], i?: number) =>
    i != null && row[i] != null && row[i] !== '' ? String(row[i]) : undefined;

  const groups: LiveGroup[] = [];
  const walk = (node: any, title: string) => {
    if (Array.isArray(node)) {
      const rows: LiveRow[] = node
        .filter((row) => Array.isArray(row))
        .map((row) => ({
          bib: val(row, 1),
          position: val(row, col.position),
          name: val(row, col.name),
          time: val(row, col.time),
          ageClass: val(row, col.ageClass),
          club: val(row, col.club),
          swim: val(row, col.swim),
          bike: val(row, col.bike),
          run: val(row, col.run),
        }));
      if (rows.length) groups.push({ title, rows });
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, cleanGroupTitle(k));
    }
  };
  walk(d?.data, '');

  return { groups, liveUpdateInterval: Number(d?.LiveUpdateInterval) || 0 };
}
