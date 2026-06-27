-- Phase B / stage 2 — push token + interest registry (RPC version).
-- Paste this whole block into the Supabase SQL editor and press Run. That's the entire backend
-- for stage 2 — no CLI, no edge functions.
--
-- Anonymous: one row per install, keyed by the Expo push token. RLS is ON with NO public
-- policies, so the tables are sealed. The app reaches them ONLY through register_device(), a
-- SECURITY DEFINER function — so a public (anon) caller can register, but can't read or touch
-- the tables directly.

create extension if not exists pgcrypto;

create table if not exists public.devices (
  id                uuid primary key default gen_random_uuid(),
  expo_push_token   text not null unique,
  platform          text not null check (platform in ('ios', 'android', 'web')),
  locale            text,
  push_enabled      boolean not null default true,
  only_my_races     boolean not null default false,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end   smallint check (quiet_hours_end between 0 and 23),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.device_interests (
  device_id uuid not null references public.devices(id) on delete cascade,
  kind      text not null check (kind in ('athlete', 'series', 'brand', 'race', 'main_race')),
  ref_id    text not null,
  primary key (device_id, kind, ref_id)
);

create index if not exists device_interests_lookup on public.device_interests (kind, ref_id);

alter table public.devices          enable row level security;
alter table public.device_interests enable row level security;
-- (no policies on purpose → tables are reachable only via the function below)

-- The app posts { payload: { token, platform, locale?, pushEnabled?, onlyMyRaces?,
-- quietHours?: {start,end}, interests: [{kind, ref_id}] } } to /rest/v1/rpc/register_device.
create or replace function public.register_device(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_token    text := payload->>'token';
  v_platform text := payload->>'platform';
begin
  if v_token is null or length(v_token) = 0 or v_platform not in ('ios', 'android', 'web') then
    raise exception 'token + valid platform required';
  end if;

  insert into public.devices (expo_push_token, platform, locale, push_enabled, only_my_races,
                              quiet_hours_start, quiet_hours_end, updated_at)
  values (
    v_token, v_platform, payload->>'locale',
    coalesce((payload->>'pushEnabled')::boolean, true),
    coalesce((payload->>'onlyMyRaces')::boolean, false),
    (payload->'quietHours'->>'start')::smallint,
    (payload->'quietHours'->>'end')::smallint,
    now()
  )
  on conflict (expo_push_token) do update set
    platform = excluded.platform, locale = excluded.locale, push_enabled = excluded.push_enabled,
    only_my_races = excluded.only_my_races, quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end, updated_at = now()
  returning id into v_id;

  -- interests are a full snapshot — replace, don't merge
  delete from public.device_interests where device_id = v_id;
  insert into public.device_interests (device_id, kind, ref_id)
  select v_id, x.kind, x.ref_id
  from jsonb_to_recordset(coalesce(payload->'interests', '[]'::jsonb)) as x(kind text, ref_id text)
  where x.kind in ('athlete', 'series', 'brand', 'race', 'main_race') and x.ref_id is not null;

  return v_id;
end;
$$;

-- anon (the app's public key) and signed-in users may CALL the function — nothing else.
revoke all on function public.register_device(jsonb) from public;
grant execute on function public.register_device(jsonb) to anon, authenticated;
