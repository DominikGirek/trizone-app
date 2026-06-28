-- Tippspiel P3 — backend for predictions + global leaderboard.
-- One tip per (user, race); scored ONCE against verified results; the leaderboard is a SECURITY DEFINER
-- aggregate (returns points only, never anyone's picks → privacy + anti-cheat). Works for anonymous
-- users too (they're the authenticated role). Paste into the SQL editor and Run. Idempotent.

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  user_id uuid not null references auth.users on delete cascade,
  race_id text not null,
  race_name text,
  race_date timestamptz,
  kind text,
  men text[] not null default '{}',
  women text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, race_id)
);

-- Verified finishing order (top 5 is enough). Owner/service-populated only — never fabricated.
create table if not exists public.race_results (
  race_id text primary key,
  men text[] not null default '{}',
  women text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── Scoring (mirrors src/lib/tippspiel.ts: exact +3, in-top5-wrong-place +1, podium +3, all-5 +5) ──
create or replace function public.score_gender(picks text[], actual text[])
returns int language plpgsql immutable as $$
declare top text[]; ex int := 0; pa int := 0; bonus int := 0; i int; pid text;
begin
  top := actual[1:5];
  for i in 1..5 loop
    pid := picks[i];
    if pid is null or pid = '' then continue; end if;
    if top[i] is not null and top[i] = pid then ex := ex + 1;
    elsif pid = any(top) then pa := pa + 1;
    end if;
  end loop;
  if coalesce(array_length(top,1),0) >= 3
     and picks[1] is not null and picks[1] = top[1]
     and picks[2] is not null and picks[2] = top[2]
     and picks[3] is not null and picks[3] = top[3] then bonus := bonus + 3; end if;
  if coalesce(array_length(top,1),0) >= 5
     and picks[1] = top[1] and picks[2] = top[2] and picks[3] = top[3]
     and picks[4] = top[4] and picks[5] = top[5] then bonus := bonus + 5; end if;
  return ex * 3 + pa * 1 + bonus;
end; $$;

-- Global leaderboard: aggregate over scored predictions (races that have results). Returns points
-- only — never picks. SECURITY DEFINER so it can read across users without exposing rows via RLS.
create or replace function public.leaderboard(limit_n int default 100)
returns table (user_id uuid, handle text, points bigint, races bigint)
language sql security definer set search_path = public as $$
  select p.user_id,
         coalesce(pr.handle, 'anon') as handle,
         sum(score_gender(p.men, r.men) + score_gender(p.women, r.women))::bigint as points,
         count(*)::bigint as races
  from predictions p
  join race_results r on r.race_id = p.race_id
  left join profiles pr on pr.id = p.user_id
  group by p.user_id, pr.handle
  order by points desc, races desc
  limit greatest(1, least(limit_n, 500));
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
alter table public.race_results enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_write" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
-- handles are public (leaderboard names); a user manages only their own profile row
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "predictions_own" on public.predictions;
-- a user can only see/write their OWN picks (others' picks stay hidden — no peeking, no cheating)
create policy "predictions_own" on public.predictions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "race_results_read_all" on public.race_results;
-- verified results are public-readable; writes only via service_role (no client policy = no client writes)
create policy "race_results_read_all" on public.race_results for select using (true);

-- ── Grants ──────────────────────────────────────────────────────────────────
grant execute on function public.leaderboard(int) to anon, authenticated;
grant execute on function public.score_gender(text[], text[]) to anon, authenticated;
