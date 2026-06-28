-- Tippspiel P4 — groups (clubs / friends) + group leaderboards + opt-in global group ranking.
-- "One tip, many boards": group boards reuse the SAME per-race scores, filtered to members. All access
-- goes through SECURITY DEFINER RPCs (tables stay locked by RLS) so we never expose anyone's picks and
-- membership stays controlled. Paste into the SQL editor and Run. Idempotent.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  owner_id uuid not null references auth.users on delete cascade,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- Tables are locked (RLS on, no policies) — everything goes through the RPCs below.
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Create a group; the creator becomes the first member.
create or replace function public.create_group(p_name text)
returns table (id uuid, name text, invite_code text, is_public boolean)
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.groups (name, owner_id) values (nullif(left(trim(p_name), 40), ''), auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return query select g.id, g.name, g.invite_code, g.is_public;
end; $$;

-- Join a group by invite code.
create or replace function public.join_group(p_code text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if g.id is null then raise exception 'group not found'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return query select g.id, g.name;
end; $$;

-- The current user's groups (with member counts).
create or replace function public.my_groups()
returns table (id uuid, name text, invite_code text, is_public boolean, members bigint)
language sql security definer set search_path = public as $$
  select g.id, g.name, g.invite_code, g.is_public,
         (select count(*) from group_members m2 where m2.group_id = g.id)::bigint
  from groups g join group_members m on m.group_id = g.id
  where m.user_id = auth.uid()
  order by g.created_at;
$$;

-- A group's leaderboard (members only; points, never picks). All members ranked, 0 if no scored tips.
create or replace function public.group_leaderboard(p_group uuid)
returns table (user_id uuid, handle text, points bigint, races bigint)
language sql security definer set search_path = public as $$
  select gm.user_id, coalesce(pr.handle, 'anon') as handle,
         coalesce(sum(case when r.race_id is not null
                           then score_gender(p.men, r.men) + score_gender(p.women, r.women) end), 0)::bigint as points,
         count(r.race_id)::bigint as races
  from group_members gm
  left join predictions p on p.user_id = gm.user_id
  left join race_results r on r.race_id = p.race_id
  left join profiles pr on pr.id = gm.user_id
  where gm.group_id = p_group
    and exists (select 1 from group_members me where me.group_id = p_group and me.user_id = auth.uid())
  group by gm.user_id, pr.handle
  order by points desc, races desc;
$$;

-- Owner toggles whether the group appears in the GLOBAL group ranking (default off).
create or replace function public.set_group_public(p_group uuid, p_public boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.groups set is_public = p_public where id = p_group and owner_id = auth.uid();
end; $$;

-- Global ranking of OPT-IN public groups, by average points per member (fair across sizes).
create or replace function public.group_global_leaderboard(limit_n int default 100)
returns table (group_id uuid, name text, members bigint, avg_points numeric)
language sql security definer set search_path = public as $$
  with member_points as (
    select gm.group_id, gm.user_id,
           coalesce(sum(case when r.race_id is not null
                             then score_gender(p.men, r.men) + score_gender(p.women, r.women) end), 0) as pts
    from group_members gm
    left join predictions p on p.user_id = gm.user_id
    left join race_results r on r.race_id = p.race_id
    group by gm.group_id, gm.user_id
  )
  select g.id, g.name, count(mp.user_id)::bigint as members, round(avg(mp.pts), 1) as avg_points
  from groups g join member_points mp on mp.group_id = g.id
  where g.is_public
  group by g.id, g.name
  order by avg_points desc, members desc
  limit greatest(1, least(limit_n, 200));
$$;

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.group_leaderboard(uuid) to authenticated;
grant execute on function public.set_group_public(uuid, boolean) to authenticated;
grant execute on function public.group_global_leaderboard(int) to anon, authenticated;
