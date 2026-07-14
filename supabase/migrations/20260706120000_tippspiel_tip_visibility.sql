-- Tippspiel — TIP VISIBILITY (social + privacy). Members of a shared group can view each other's tips,
-- BUT only after a race LOCKS (anti-cheat: never reveal a pick before its race has started), and only if
-- the tipper hasn't hidden their tips. Paste into the SQL editor and Run. Idempotent.

-- Per-user privacy switch. Default TRUE = tips visible to your groups (opt-out), matching the social
-- intent; a user flips it off to keep their tips private.
alter table public.profiles add column if not exists tips_public boolean not null default true;

-- One group member's tips, strictly gated. SECURITY DEFINER so it can read predictions across users
-- (which stay RLS-locked to their owner), but the WHERE clause enforces:
--   • caller and target are both members of p_group,
--   • YOUR OWN tips are always returned (any lock state),
--   • OTHERS' tips only once the race is locked (race_date <= now) AND they haven't hidden them.
create or replace function public.group_member_tips(p_group uuid, p_user uuid)
returns table (race_id text, race_name text, race_date timestamptz, men text[], women text[])
language sql security definer set search_path = public as $$
  select p.race_id, p.race_name, p.race_date, p.men, p.women
  from predictions p
  where p.user_id = p_user
    and exists (select 1 from group_members me  where me.group_id = p_group and me.user_id = auth.uid())
    and exists (select 1 from group_members him where him.group_id = p_group and him.user_id = p_user)
    and (
      p_user = auth.uid()  -- your own tips: always
      or (
        p.race_date is not null and p.race_date <= now()  -- others: locked races only (anti-cheat)
        and coalesce((select pr.tips_public from profiles pr where pr.id = p_user), true)  -- and not hidden
      )
    )
  order by p.race_date desc nulls last;
$$;

grant execute on function public.group_member_tips(uuid, uuid) to authenticated;
