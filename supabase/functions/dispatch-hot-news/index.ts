// dispatch-hot-news — the push sender (Phase B / stage 3b).
//
// Runs on a schedule. For every race a user follows ("Meine Rennen" / Hauptrennen), it checks the
// German triathlon feeds for a recent headline reporting a time-critical change (cancel / shorten /
// postpone / delay) and notifies that race's followers — once per race+category (sent_log dedup).
//
// Safety: push_config.mode gates everything.
//   off    → does nothing
//   dryrun → computes + RETURNS what it would send, writes nothing, sends nothing   (DEFAULT)
//   live   → sends via Expo Push + records the send in sent_log
//
// Targeting is intentionally narrow for v1: only race-followers (smallest, most relevant audience).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by Supabase. Optional DISPATCH_SECRET gates
// who can trigger it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TRIGGER_SECRET = Deno.env.get('DISPATCH_SECRET') || '';

const FEEDS = [
  'https://www.tri-mag.de/feed/',
  'https://www.tri2b.com/feed/',
  'https://www.trinews.at/feed/',
  'https://www.triathlon.de/blogs/journal.atom',
];

// Impact lexicon — kept in sync with src/lib/hotNews.ts.
const IMPACT: { re: RegExp; severity: 'critical' | 'major' | 'minor'; category: string; label: string }[] = [
  { re: /(abgesagt|abgebrochen|annulliert|cancell?ed|cancellation|evakuiert|called off)/i, severity: 'critical', category: 'cancelled', label: 'Abgesagt' },
  { re: /(verk[üu]rzt|gek[üu]rzt|eingek[üu]rzt|shortened)/i, severity: 'major', category: 'shortened', label: 'Verkürzt' },
  { re: /(verlegt|verschoben|postponed|rescheduled|neuer termin|verschiebung)/i, severity: 'major', category: 'postponed', label: 'Verschoben' },
  { re: /(verz[öo]gert|delayed|startverschiebung|hitzewarnung)/i, severity: 'minor', category: 'delayed', label: 'Verzögert' },
];
const RANK: Record<string, number> = { critical: 3, major: 2, minor: 1 };
const STOP = new Set(['ironman', 'challenge', 'triathlon', 'world', 'championship', 'championships', 'series', 'european', 'powered', 'presented', 'the', 'und', 'and', 'von', 'der', 'die', 'das', 't100', 'sprint', 'olympic', 'mixed', 'relay', 'tri', 'cup', 'race', 'rennen', 'international', 'national', 'regional']);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokensOf = (name: string) => [...new Set(fold(name).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOP.has(t)))];
const wordRe = (tok: string) => new RegExp(`(^|[^a-z0-9])${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i');
const titleHitsRace = (title: string, toks: string[]) => { const t = fold(title); return toks.some((tk) => wordRe(tk).test(t)); };
const impactOf = (title: string) => IMPACT.find((i) => i.re.test(title)) ?? null;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&#8217;/g, '’').replace(/&#8211;/g, '–');

type Headline = { title: string; link: string; published: number };

async function fetchHeadlines(): Promise<Headline[]> {
  const out: Headline[] = [];
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const url of FEEDS) {
    try {
      const xml = await (await fetch(url, { headers: { 'user-agent': 'TriZone/1.0 (+https://trizone.app)' } })).text();
      for (const it of xml.split(/<item[\s>]|<entry[\s>]/).slice(1)) {
        const title = decode((it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '').trim();
        const link = ((it.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?:[\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || (it.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '').trim();
        const ds = ((it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || it.match(/<published>([\s\S]*?)<\/published>/) || it.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '').trim();
        const published = ds ? Date.parse(ds) : Date.now();
        if (title && (isNaN(published) || published >= cutoff)) out.push({ title, link, published: isNaN(published) ? Date.now() : published });
      }
    } catch { /* skip a flaky feed */ }
  }
  return out;
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (TRIGGER_SECRET && req.headers.get('x-dispatch-secret') !== TRIGGER_SECRET) return json({ error: 'forbidden' }, 403);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: cfg } = await sb.from('push_config').select('mode').eq('id', true).single();
  const mode = (cfg?.mode as string) ?? 'dryrun';
  if (mode === 'off') return json({ ok: true, mode });

  // Followed races (with a name) joined to their push-enabled, non-web devices.
  const { data: rows, error } = await sb
    .from('device_interests')
    .select('ref_id, name, devices!inner(id, expo_push_token, platform, push_enabled)')
    .in('kind', ['race', 'main_race'])
    .not('name', 'is', null)
    .eq('devices.push_enabled', true)
    .neq('devices.platform', 'web');
  if (error) return json({ error: error.message }, 500);

  type Dev = { id: string; expo_push_token: string };
  const races = new Map<string, { name: string; followers: Dev[] }>();
  for (const r of (rows ?? []) as { ref_id: string; name: string; devices: Dev }[]) {
    const e = races.get(r.ref_id) ?? { name: r.name, followers: [] };
    e.followers.push(r.devices);
    races.set(r.ref_id, e);
  }
  if (races.size === 0) return json({ ok: true, mode, races: 0, note: 'no followed races yet' });

  const headlines = await fetchHeadlines();
  const alerts: { race: string; category: string; headline: string; targets: number }[] = [];
  const ledger: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];

  for (const [ref_id, race] of races) {
    const toks = tokensOf(race.name);
    if (!toks.length) continue;

    let hot: { h: Headline; imp: (typeof IMPACT)[number] } | null = null;
    for (const h of headlines) {
      if (!titleHitsRace(h.title, toks)) continue;
      const imp = impactOf(h.title);
      if (!imp) continue;
      if (!hot || RANK[imp.severity] > RANK[hot.imp.severity] || h.published > hot.h.published) hot = { h, imp };
    }
    if (!hot) continue;

    // Dedup against ACTUAL (live) sends only, so dryrun never blocks a later real send.
    const { data: sent } = await sb.from('sent_log').select('device_id').eq('ref_id', ref_id).eq('category', hot.imp.category).eq('mode', 'live');
    const done = new Set((sent ?? []).map((s: { device_id: string }) => s.device_id));
    const targets = race.followers.filter((f) => !done.has(f.id));
    if (!targets.length) continue;

    alerts.push({ race: race.name, category: hot.imp.category, headline: hot.h.title, targets: targets.length });
    for (const f of targets) {
      if (mode === 'live') {
        ledger.push({ ref_id, category: hot.imp.category, device_id: f.id, article_url: hot.h.link, mode: 'live' });
        messages.push({ to: f.expo_push_token, title: `${hot.imp.label} · ${race.name}`, body: hot.h.title, sound: 'default', data: { ref_id } });
      }
    }
  }

  let pushed = 0;
  if (mode === 'live') {
    if (ledger.length) await sb.from('sent_log').insert(ledger);
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(chunk) });
        pushed += chunk.length;
      } catch { /* a chunk failed; receipts handled later */ }
    }
  }

  // dryrun returns exactly what it WOULD send (writes nothing); live reports what it sent.
  return json({ ok: true, mode, races: races.size, headlines: headlines.length, alerts, pushed });
});
