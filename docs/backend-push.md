# Backend — Push (Phase B)

Managed serverless on **Supabase** (project `TriZone`, region West EU / Ireland). Stage 2 stands up
the **device + interest registry**; the app calls one Edge Function, never the tables directly.

Project ref: `vldepqrkbdrspgtbyyxu` (from the project URL — not a secret).

## One-time: Supabase CLI

```bash
brew install supabase/tap/supabase      # or: npm i -g supabase
supabase login                          # opens the browser
supabase link --project-ref vldepqrkbdrspgtbyyxu
```

## Deploy stage 2

```bash
# 1) schema → creates devices + device_interests (RLS locked to service_role)
supabase db push

# 2) the register endpoint
supabase functions deploy register-device
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions automatically — you
do **not** set those by hand. (The classifier's `ANTHROPIC_API_KEY` comes in stage 3:
`supabase secrets set ANTHROPIC_API_KEY=…`.)

## App env (public — safe to commit to your build config)

Set these so the app knows where to register (anon key is public by design):

```
EXPO_PUBLIC_SUPABASE_URL=https://vldepqrkbdrspgtbyyxu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your project's anon/public key>
```

Local dev: put them in `.env` (see `.env.example`). For builds: `eas env:create` (or the EAS
dashboard) for the `production`/`preview` profiles. If unset, the app simply skips registration —
nothing breaks.

## Smoke-test the function (no app needed)

```bash
curl -s -X POST \
  "https://vldepqrkbdrspgtbyyxu.supabase.co/functions/v1/register-device" \
  -H "Authorization: Bearer <anon key>" \
  -H "content-type: application/json" \
  -d '{"token":"ExponentPushToken[test-1]","platform":"ios","locale":"de",
       "interests":[{"kind":"series","refId":"ironman"},{"kind":"race","refId":"se-im-nice"}]}'
# → {"ok":true,"deviceId":"…","interests":2}
```

Then in the Supabase **Table editor**: `devices` has the row, `device_interests` has 2 rows. Re-running
with the same token updates in place (no duplicates).

## What stays server-side / never in the app or chat

`service_role` key and `ANTHROPIC_API_KEY` are secrets — they live only in Supabase. The app ships only
the **anon** key (public). Tokens + interests are personal data → EU region + a delete path (a device is
removed when push is turned off; stage 4 adds the explicit opt-out wipe).
