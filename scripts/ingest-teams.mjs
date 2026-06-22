#!/usr/bin/env node
/**
 * Builds a team → league index for the standings search ("find every league a
 * team competes in"). Only the LIVE it4sport DTU leagues have a readable table,
 * so coverage is those leagues (Bundesliga, 2. Bundesliga, readable Regionalligen).
 * Link-only leagues (NRW/Bayern/BW/Hessen portals) can't be read → not indexed.
 *
 * Output: src/data/teamIndex.json — a bundled snapshot the app reads. Re-run to
 * refresh (e.g. via cron / GitHub Action), like scripts/ingest-events.mjs.
 *
 *   npm run ingest:teams
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://dtu.it4sport.de/api/league/widget/table';
const TOKEN = '1C8D23A0-7634-4F99-B883-79AD72177324';
const YEAR = new Date().getFullYear();
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'teamIndex.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const divRes = await fetch(`${API}?X-Auth-Token=${TOKEN}&year=${YEAR}`);
  if (!divRes.ok) throw new Error(`divisions ${divRes.status}`);
  const divData = await divRes.json();
  const divisions = Object.entries(divData.divisions ?? {}).filter(([, n]) => /liga/i.test(n));

  const leagues = [];
  for (const [guid, name] of divisions) {
    try {
      const res = await fetch(`${API}?X-Auth-Token=${TOKEN}&year=${YEAR}&uDivision=${guid}`);
      if (!res.ok) continue;
      const d = await res.json();
      const teams = (Array.isArray(d.table) ? d.table : [])
        .map((t) => String(t.MSName ?? '').trim())
        .filter(Boolean);
      if (teams.length) leagues.push({ id: `dtu:${guid}`, divisionGuid: guid, name: String(name), teams });
      process.stdout.write(`· ${name}: ${teams.length} Teams\n`);
    } catch (e) {
      process.stdout.write(`! ${name}: ${e.message}\n`);
    }
    await sleep(150); // polite
  }

  const index = { generatedAt: new Date().toISOString(), leagues };
  await writeFile(OUT, JSON.stringify(index, null, 2) + '\n');
  const teamCount = leagues.reduce((n, l) => n + l.teams.length, 0);
  process.stdout.write(`\n✓ ${leagues.length} Ligen, ${teamCount} Teams → ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
