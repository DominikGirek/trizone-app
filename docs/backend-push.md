# Backend — Push (Phase B)

Managed serverless on **Supabase** (project `TriZone`, region West EU / Ireland). Stage 2 is the
**device + interest registry**. No CLI, no edge functions — it's a single Postgres function the app
calls. The app reaches the (RLS-sealed) tables only through that function.

Project: `https://vldepqrkbdrspgtbyyxu.supabase.co` (ref `vldepqrkbdrspgtbyyxu` — not a secret).

## Deploy = one paste (≈30 seconds)

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the whole contents of `supabase/migrations/20260627120000_phaseb_init.sql`.
3. **Run**. Done — it creates `devices`, `device_interests`, and the `register_device` function.

(Idempotent: safe to run again.)

## App config (public — anon key is meant to ship)

Supabase → **Project Settings → API** → copy the **Project URL** and the **anon / public** key:

```
EXPO_PUBLIC_SUPABASE_URL=https://vldepqrkbdrspgtbyyxu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / public key>
```

Local dev → `.env.local` (git-ignored, see `.env.example`). Builds → set both via EAS env on the
`production` + `preview` profiles. If unset, the app simply skips registration — nothing breaks.

## Smoke-test (no app needed)

```bash
curl -s -X POST \
  "https://vldepqrkbdrspgtbyyxu.supabase.co/rest/v1/rpc/register_device" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>" \
  -H "content-type: application/json" \
  -d '{"payload":{"token":"ExponentPushToken[test-1]","platform":"ios","locale":"de",
       "interests":[{"kind":"series","ref_id":"ironman"},{"kind":"race","ref_id":"se-im-nice"}]}}'
# → a uuid string (the device id)
```

Then in the **Table editor**: `devices` has the row, `device_interests` has 2 rows. Re-running with
the same token updates in place (no duplicates).

## Notes

- **Secrets stay in Supabase.** The app ships only the public anon key. The `service_role` key and
  (stage 3) `ANTHROPIC_API_KEY` never appear in the app or in chat.
- **iOS push** additionally needs an APNs key in EAS — that's a stage-3 concern (stage 2 only
  registers tokens, it doesn't send anything yet).
- GDPR: tokens + interests are personal data → EU region + a delete path (push-off removes the
  device; stage 4 adds the explicit opt-out wipe).
