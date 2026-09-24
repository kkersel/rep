create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  friend_code text not null unique check (char_length(friend_code) = 6),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id), check (requester_id <> addressee_id)
);
create table public.programs (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  baseline int not null, step int not null, start_date date not null, status text not null,
  payload jsonb not null, updated_at timestamptz not null default now()
);
create table public.workout_sessions (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null, reps int not null check (reps >= 0), seconds int not null check (seconds >= 0),
  goal int not null default 0, mode text not null check (mode in ('program','free','pvp')), program_day int,
  pvp_result text check (pvp_result is null or pvp_result in ('win','loss','draw')),
  created_at timestamptz not null default now()
);
create table public.matches (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  state text not null default 'waiting' check (state in ('waiting','countdown','active','finished','cancelled')),
  kind text not null check (kind in ('private','random')), start_at timestamptz, ends_at timestamptz,
  winner_id uuid references auth.users(id), created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '15 minutes'
);
create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat in (1,2)), nickname text not null, ready boolean not null default false,
  score int not null default 0 check (score >= 0), sequence int not null default 0, forfeited boolean not null default false,
  updated_at timestamptz not null default now(), primary key(match_id,user_id), unique(match_id,seat)
);
create table public.matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade, nickname text not null, best_60s int not null default 0,
  joined_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.programs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.matchmaking_queue enable row level security;

create or replace function public.is_match_member(p_match_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.match_players where match_id=p_match_id and user_id=(select auth.uid()));
$$;
revoke all on function public.is_match_member(uuid) from public,anon;
grant execute on function public.is_match_member(uuid) to authenticated;

create policy "profiles visible to related users" on public.profiles for select to authenticated using (
  user_id=(select auth.uid()) or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=(select auth.uid()) and f.addressee_id=user_id) or (f.addressee_id=(select auth.uid()) and f.requester_id=user_id)))
  or exists(select 1 from public.match_players mine join public.match_players theirs on mine.match_id=theirs.match_id where mine.user_id=(select auth.uid()) and theirs.user_id=profiles.user_id)
);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "friendships participants read" on public.friendships for select to authenticated using ((select auth.uid()) in (requester_id,addressee_id));
create policy "friendships requester insert" on public.friendships for insert to authenticated with check ((select auth.uid())=requester_id);
create policy "friendships participants update" on public.friendships for update to authenticated using ((select auth.uid()) in (requester_id,addressee_id)) with check ((select auth.uid()) in (requester_id,addressee_id));
create policy "program owner all" on public.programs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "sessions owner or friend read" on public.workout_sessions for select to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=(select auth.uid()) and f.addressee_id=user_id) or (f.addressee_id=(select auth.uid()) and f.requester_id=user_id))));
create policy "sessions own insert" on public.workout_sessions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "sessions own update" on public.workout_sessions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "participants read matches" on public.matches for select to authenticated using (public.is_match_member(id));
create policy "participants read players" on public.match_players for select to authenticated using (public.is_match_member(match_id));
create policy "queue own read" on public.matchmaking_queue for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.claim_pvp_match(p_user uuid,p_nickname text,p_best int)
returns uuid language plpgsql security definer set search_path=public as $$
declare candidate public.matchmaking_queue; new_match uuid; wait_seconds int; allowed_gap int;
begin
  if p_user is null then raise exception 'user required'; end if;
  select extract(epoch from(now()-joined_at))::int into wait_seconds from public.matchmaking_queue where user_id=p_user;
  allowed_gap:=case when coalesce(wait_seconds,0)>=30 then 10000 else 5+5*floor(coalesce(wait_seconds,0)/10)::int end;
  select * into candidate from public.matchmaking_queue where user_id<>p_user and abs(best_60s-p_best)<=allowed_gap order by joined_at for update skip locked limit 1;
  if candidate.user_id is null then insert into public.matchmaking_queue(user_id,nickname,best_60s) values(p_user,p_nickname,p_best) on conflict(user_id) do update set nickname=excluded.nickname,best_60s=excluded.best_60s; return null; end if;
  insert into public.matches(code,kind) values(upper(substr(encode(gen_random_bytes(6),'hex'),1,6)),'random') returning id into new_match;
  insert into public.match_players(match_id,user_id,seat,nickname) values(new_match,candidate.user_id,1,candidate.nickname),(new_match,p_user,2,p_nickname);
  delete from public.matchmaking_queue where user_id in(candidate.user_id,p_user); return new_match;
end $$;
revoke all on function public.claim_pvp_match(uuid,text,int) from public,anon,authenticated;
grant execute on function public.claim_pvp_match(uuid,text,int) to service_role;

do $$ begin alter publication supabase_realtime add table public.matches; exception when duplicate_object then null; end $$;

create policy "match members receive realtime" on realtime.messages for select to authenticated using (
  extension in ('broadcast','presence') and split_part((select realtime.topic()),':',1)='match' and public.is_match_member(split_part((select realtime.topic()),':',2)::uuid)
);
create policy "match members send realtime" on realtime.messages for insert to authenticated with check (
  extension in ('broadcast','presence') and split_part((select realtime.topic()),':',1)='match' and public.is_match_member(split_part((select realtime.topic()),':',2)::uuid)
);

grant select,insert,update on public.profiles,public.friendships,public.programs,public.workout_sessions to authenticated;
grant select on public.matches,public.match_players,public.matchmaking_queue to authenticated;
