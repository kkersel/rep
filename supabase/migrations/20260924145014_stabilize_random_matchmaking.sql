create index if not exists match_players_user_updated_idx
  on public.match_players(user_id, updated_at desc, match_id);

create index if not exists matchmaking_queue_joined_idx
  on public.matchmaking_queue(joined_at, user_id);

create or replace function public.claim_pvp_match(p_user uuid,p_nickname text,p_best int)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  candidate public.matchmaking_queue;
  existing_match uuid;
  new_match uuid;
  wait_seconds int;
  allowed_gap int;
begin
  if p_user is null then raise exception 'user required'; end if;

  -- Pairing touches two queue rows. Serialize this short critical section so
  -- concurrent callers cannot lock the same two users in reverse order.
  perform pg_advisory_xact_lock(20260924,1);

  -- Another request may have selected this caller after the Edge Function's
  -- previous poll. Return that match atomically instead of queuing it again.
  select m.id
  into existing_match
  from public.match_players mp
  join public.matches m on m.id=mp.match_id
  where mp.user_id=p_user
    and m.state in ('waiting','countdown','active')
    and m.expires_at>now()
  order by m.created_at desc
  limit 1;

  if existing_match is not null then
    delete from public.matchmaking_queue where user_id=p_user;
    return existing_match;
  end if;

  insert into public.matchmaking_queue(user_id,nickname,best_60s)
  values(p_user,p_nickname,greatest(coalesce(p_best,0),0))
  on conflict(user_id) do update
    set nickname=excluded.nickname,best_60s=excluded.best_60s;

  select extract(epoch from(now()-joined_at))::int
  into wait_seconds
  from public.matchmaking_queue
  where user_id=p_user;

  allowed_gap:=case
    when coalesce(wait_seconds,0)>=30 then 10000
    else 5+5*floor(coalesce(wait_seconds,0)/10)::int
  end;

  select q.*
  into candidate
  from public.matchmaking_queue q
  where q.user_id<>p_user
    and abs(q.best_60s-greatest(coalesce(p_best,0),0))<=allowed_gap
    and not exists (
      select 1
      from public.match_players mp
      join public.matches m on m.id=mp.match_id
      where mp.user_id=q.user_id
        and m.state in ('waiting','countdown','active')
        and m.expires_at>now()
    )
  order by q.joined_at,q.user_id
  for update of q
  limit 1;

  if candidate.user_id is null then return null; end if;

  insert into public.matches(code,kind,state)
  values(upper(substr(md5(gen_random_uuid()::text),1,6)),'random','waiting')
  returning id into new_match;

  insert into public.match_players(match_id,user_id,seat,nickname)
  values
    (new_match,candidate.user_id,1,candidate.nickname),
    (new_match,p_user,2,p_nickname);

  delete from public.matchmaking_queue
  where user_id in(candidate.user_id,p_user);

  return new_match;
end $$;

revoke all on function public.claim_pvp_match(uuid,text,int) from public,anon,authenticated;
grant execute on function public.claim_pvp_match(uuid,text,int) to service_role;
