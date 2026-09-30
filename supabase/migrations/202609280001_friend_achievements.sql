create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  current int not null default 0 check (current >= 0),
  target int not null check (target > 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

drop policy if exists "achievements owner or friend read" on public.user_achievements;
create policy "achievements owner or friend read" on public.user_achievements
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = user_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = user_id))
  )
);

drop policy if exists "achievements own insert" on public.user_achievements;
create policy "achievements own insert" on public.user_achievements
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "achievements own update" on public.user_achievements;
create policy "achievements own update" on public.user_achievements
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_achievements to authenticated;
