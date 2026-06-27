-- Phase B / stage 2 — push token + interest registry.
-- Anonymous: one row per install, keyed by the Expo push token. No accounts yet.
-- RLS is ON with NO public policies, so ONLY the service_role (the Edge Functions) can touch
-- these tables — the app never reads/writes them directly, it only calls register-device.

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

-- What each device follows. The detector joins on (kind, ref_id) to find who to notify.
create table if not exists public.device_interests (
  device_id uuid not null references public.devices(id) on delete cascade,
  kind      text not null check (kind in ('athlete', 'series', 'brand', 'race', 'main_race')),
  ref_id    text not null,
  primary key (device_id, kind, ref_id)
);

create index if not exists device_interests_lookup on public.device_interests (kind, ref_id);

alter table public.devices          enable row level security;
alter table public.device_interests enable row level security;
-- (no policies on purpose → locked to service_role)
