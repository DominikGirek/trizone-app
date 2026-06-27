// register-device — the app posts its Expo push token + interests here on launch / when
// favorites change. Anonymous (no account). Runs with the service_role that Supabase injects
// into Edge Functions, so the app never needs table access. Phase B / stage 2.
//
// Deploy:  supabase functions deploy register-device
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided to the function automatically.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

type Interest = { kind: string; refId: string };
const KINDS = new Set(['athlete', 'series', 'brand', 'race', 'main_race']);
const PLATFORMS = new Set(['ios', 'android', 'web']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  const platform = String(payload.platform ?? '');
  if (!token || !platform.length) return json({ error: 'token + platform required' }, 400);
  if (!PLATFORMS.has(platform)) return json({ error: 'bad platform' }, 400);

  const quiet = (payload.quietHours ?? {}) as { start?: number; end?: number };
  const interests = Array.isArray(payload.interests) ? (payload.interests as Interest[]) : [];

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { data: dev, error: e1 } = await sb
      .from('devices')
      .upsert(
        {
          expo_push_token: token,
          platform,
          locale: typeof payload.locale === 'string' ? payload.locale : null,
          push_enabled: payload.pushEnabled !== false,
          only_my_races: payload.onlyMyRaces === true,
          quiet_hours_start: Number.isInteger(quiet.start) ? quiet.start : null,
          quiet_hours_end: Number.isInteger(quiet.end) ? quiet.end : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' },
      )
      .select('id')
      .single();
    if (e1) throw e1;

    // Interests are a full snapshot — replace, don't merge.
    await sb.from('device_interests').delete().eq('device_id', dev.id);
    const rows = interests
      .filter((i) => i && KINDS.has(i.kind) && i.refId)
      .map((i) => ({ device_id: dev.id, kind: i.kind, ref_id: String(i.refId) }));
    if (rows.length) {
      const { error: e2 } = await sb.from('device_interests').insert(rows);
      if (e2) throw e2;
    }

    return json({ ok: true, deviceId: dev.id, interests: rows.length });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
