-- Phase B / stage 3 — hot-news dispatch foundation.
-- Adds: race name on interests (so the sender can match headlines without the full race calendar),
-- a sent_log dedup/escalation ledger, and a single-row kill-switch (off | dryrun | live).
-- Paste into the SQL editor and Run. Idempotent.

alter table public.device_interests add column if not exists name text;

create table if not exists public.sent_log (
  id          bigint generated always as identity primary key,
  ref_id      text not null,        -- the race the alert was about
  category    text not null,        -- cancelled | shortened | postponed | delayed
  device_id   uuid references public.devices(id) on delete cascade,
  article_url text,
  mode        text not null default 'live',
  sent_at     timestamptz not null default now()
);
create index if not exists sent_log_dedup on public.sent_log (ref_id, category, device_id);

-- One-row kill switch. dryrun (default) records intended sends but pushes nothing.
create table if not exists public.push_config (
  id         boolean primary key default true check (id),
  mode       text not null default 'dryrun' check (mode in ('off', 'dryrun', 'live')),
  updated_at timestamptz not null default now()
);
insert into public.push_config (id, mode) values (true, 'dryrun') on conflict (id) do nothing;

alter table public.sent_log    enable row level security;
alter table public.push_config enable row level security;

-- Registry function now also stores the (optional) race name on each interest.
create or replace function public.register_device(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_token text := payload->>'token';
  v_platform text := payload->>'platform';
begin
  if v_token is null or length(v_token) = 0 or v_platform not in ('ios', 'android', 'web') then
    raise exception 'token + valid platform required';
  end if;
  insert into public.devices (expo_push_token, platform, locale, push_enabled, only_my_races,
                              quiet_hours_start, quiet_hours_end, updated_at)
  values (v_token, v_platform, payload->>'locale',
          coalesce((payload->>'pushEnabled')::boolean, true),
          coalesce((payload->>'onlyMyRaces')::boolean, false),
          (payload->'quietHours'->>'start')::smallint,
          (payload->'quietHours'->>'end')::smallint, now())
  on conflict (expo_push_token) do update set
    platform = excluded.platform, locale = excluded.locale, push_enabled = excluded.push_enabled,
    only_my_races = excluded.only_my_races, quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end, updated_at = now()
  returning id into v_id;
  delete from public.device_interests where device_id = v_id;
  insert into public.device_interests (device_id, kind, ref_id, name)
  select v_id, x.kind, x.ref_id, x.name
  from jsonb_to_recordset(coalesce(payload->'interests', '[]'::jsonb))
       as x(kind text, ref_id text, name text)
  where x.kind in ('athlete', 'series', 'brand', 'race', 'main_race') and x.ref_id is not null;
  return v_id;
end;
$$;

revoke all on function public.register_device(jsonb) from public;
grant execute on function public.register_device(jsonb) to anon, authenticated;
