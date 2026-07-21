-- Robot fleet — run log ("robot_runs"). The Cockpit reads this (docs/robot-fleet.md §5: "Führung durch
-- Ausnahme"). Every robot run — above all Tobi's result runs — writes ONE row: what it did, its confidence,
-- and whether it AUTO-PUBLISHED or STAGED for approval. Nothing here is user-facing; it is the ops blackbox.
--
-- DRAFT for Slice 1 — NOT yet applied to prod. Applied in Slice 3 (with the GitHub Action) via the SQL
-- editor, together with the SUPABASE_SERVICE_ROLE_KEY secret. Idempotent.

create table if not exists public.robot_runs (
  id            uuid primary key default gen_random_uuid(),
  robot         text not null,                                   -- 'tobi', 'startlist', …
  race_id       text,                                            -- app race id when applicable
  status        text not null check (status in ('publish', 'stage', 'fail', 'ok')),
  confidence    int  not null default 0,                         -- 0..100
  men           text[] not null default '{}',                    -- reconstructed top-5 (winner first)
  women         text[] not null default '{}',
  source_count  int  not null default 0,
  unknown_slugs text[] not null default '{}',                    -- flagged, unresolved finisher slugs
  note          text,
  ran_at        timestamptz not null default now()
);

-- Staged runs ARE the approval inbox; index the Cockpit's two hot queries.
create index if not exists robot_runs_staged_idx on public.robot_runs (ran_at desc) where status = 'stage';
create index if not exists robot_runs_robot_idx  on public.robot_runs (robot, ran_at desc);

-- RLS on. The app's public client (anon/authenticated) gets NO policy ⇒ default-deny: the ops log is not
-- readable from the normal app. Inserts come from the GitHub Action using the SERVICE_ROLE key, which
-- bypasses RLS. The admin read path (Cockpit, Slice 5) adds a policy scoped to Dominik's user id then.
alter table public.robot_runs enable row level security;
