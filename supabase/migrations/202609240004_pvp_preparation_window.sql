create or replace function public.claim_pvp_match(p_user uuid,p_nickname text,p_best int)
returns uuid language plpgsql security definer set search_path=public as $$
declare candidate public.matchmaking_queue; new_match uuid; wait_seconds int; allowed_gap int; start_time timestamptz;
begin
  if p_user is null then raise exception 'user required'; end if;
  select extract(epoch from(now()-joined_at))::int into wait_seconds from public.matchmaking_queue where user_id=p_user;
  allowed_gap:=case when coalesce(wait_seconds,0)>=30 then 10000 else 5+5*floor(coalesce(wait_seconds,0)/10)::int end;
  select * into candidate from public.matchmaking_queue where user_id<>p_user and abs(best_60s-p_best)<=allowed_gap order by joined_at for update skip locked limit 1;
  if candidate.user_id is null then insert into public.matchmaking_queue(user_id,nickname,best_60s) values(p_user,p_nickname,p_best) on conflict(user_id) do update set nickname=excluded.nickname,best_60s=excluded.best_60s; return null; end if;
  start_time:=now()+interval '8 seconds';
  insert into public.matches(code,kind,state,start_at,ends_at) values(upper(substr(md5(gen_random_uuid()::text),1,6)),'random','countdown',start_time,start_time+interval '60 seconds') returning id into new_match;
  insert into public.match_players(match_id,user_id,seat,nickname) values(new_match,candidate.user_id,1,candidate.nickname),(new_match,p_user,2,p_nickname);
  delete from public.matchmaking_queue where user_id in(candidate.user_id,p_user); return new_match;
end $$;

revoke all on function public.claim_pvp_match(uuid,text,int) from public,anon,authenticated;
grant execute on function public.claim_pvp_match(uuid,text,int) to service_role;
