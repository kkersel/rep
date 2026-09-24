import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[n%31]).join('');
const checked=<T extends{error:unknown}>(result:T)=>{if(result.error)throw result.error;return result};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 try{
  const auth=req.headers.get('Authorization')??'',url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const{data:{user},error:userError}=await authClient.auth.getUser();if(userError||!user)return json({error:'unauthorized'},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),body=await req.json(),action=String(body.action??'');
  const profile=(await db.from('profiles').select('nickname').eq('user_id',user.id).single()).data;if(!profile)return json({error:'profile required'},400);
  if(action==='create_private'){
   let match:any=null;for(let i=0;i<4&&!match;i++){const r=await db.from('matches').insert({code:code(),kind:'private'}).select().single();if(!r.error)match=r.data}if(!match)return json({error:'room creation failed'},500);
   checked(await db.from('match_players').insert({match_id:match.id,user_id:user.id,seat:1,nickname:profile.nickname}));return json({matchId:match.id,code:match.code,match});
  }
  if(action==='join_private'){
   const room=(await db.from('matches').select('*').eq('code',String(body.code??'').toUpperCase()).eq('state','waiting').gt('expires_at',new Date().toISOString()).single()).data;if(!room)return json({error:'Комната не найдена'},404);
   const occupiedResult=checked(await db.from('match_players').select('user_id').eq('match_id',room.id)),occupied=occupiedResult.data??[];if(occupied.some(player=>player.user_id===user.id))return json({error:'Вы уже в этой комнате'},409);if(occupied.length>=2)return json({error:'Комната заполнена'},409);
   checked(await db.from('match_players').insert({match_id:room.id,user_id:user.id,seat:2,nickname:profile.nickname}));return json({matchId:room.id,code:room.code,match:room});
  }
  if(action==='queue_random'){
   const best=Number(body.best60??0);const{data,error}=await db.rpc('claim_pvp_match',{p_user:user.id,p_nickname:profile.nickname,p_best:best});if(error)throw error;return json(data?{matchId:data}:{queued:true});
  }
  if(action==='cancel_queue'){await db.from('matchmaking_queue').delete().eq('user_id',user.id);return json({ok:true});}
  if(action==='add_friend_code'){
   const other=(await db.from('profiles').select('user_id').eq('friend_code',String(body.code??'').toUpperCase()).neq('user_id',user.id).maybeSingle()).data;if(!other)return json({error:'Пользователь с таким кодом не найден'},404);
   const requester=user.id<other.user_id?user.id:other.user_id,addressee=user.id<other.user_id?other.user_id:user.id;
   const result=await db.from('friendships').upsert({requester_id:requester,addressee_id:addressee,status:'accepted'},{onConflict:'requester_id,addressee_id'});if(result.error)throw result.error;return json({ok:true});
  }
  const matchId=String(body.matchId??'');const membership=(await db.from('match_players').select('*').eq('match_id',matchId).eq('user_id',user.id).single()).data;if(!membership)return json({error:'not a participant'},403);
  if(action==='status'){
   const match=(await db.from('matches').select('*').eq('id',matchId).single()).data,players=(await db.from('match_players').select('*').eq('match_id',matchId).order('seat')).data??[];return json({match:{...match,participants:players,startAt:match?.start_at,endsAt:match?.ends_at}});
  }
  if(action==='add_friend'){
   const other=(await db.from('match_players').select('user_id').eq('match_id',matchId).neq('user_id',user.id).maybeSingle()).data;if(!other)return json({error:'opponent not found'},404);
   const requester=user.id<other.user_id?user.id:other.user_id,addressee=user.id<other.user_id?other.user_id:user.id;
   const result=await db.from('friendships').upsert({requester_id:requester,addressee_id:addressee,status:'accepted'},{onConflict:'requester_id,addressee_id'});if(result.error)throw result.error;return json({ok:true});
  }
  if(action==='rematch'){
   const players=(await db.from('match_players').select('user_id,seat,nickname').eq('match_id',matchId).order('seat')).data??[];if(players.length!==2)return json({error:'opponent not found'},404);
   let match:any=null;for(let i=0;i<4&&!match;i++){const r=await db.from('matches').insert({code:code(),kind:'private'}).select().single();if(!r.error)match=r.data}if(!match)return json({error:'room creation failed'},500);
   const inserted=await db.from('match_players').insert(players.map(player=>({match_id:match.id,user_id:player.user_id,seat:player.seat,nickname:player.nickname})));if(inserted.error)throw inserted.error;return json({matchId:match.id,code:match.code,match});
  }
  if(action==='ready'){
   checked(await db.from('match_players').update({ready:true,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('user_id',user.id));const players=checked(await db.from('match_players').select('*').eq('match_id',matchId)).data??[];
   if(players.length===2&&players.every(player=>player.ready)){const start=new Date(Date.now()+4000),end=new Date(start.getTime()+60000);checked(await db.from('matches').update({state:'countdown',start_at:start.toISOString(),ends_at:end.toISOString()}).eq('id',matchId).eq('state','waiting'));}
   const match=(await db.from('matches').select('*').eq('id',matchId).single()).data;return json({match:{...match,participants:players,startAt:match?.start_at,endsAt:match?.ends_at}});
  }
  if(action==='checkpoint'){
   const match=(await db.from('matches').select('ends_at,state').eq('id',matchId).single()).data;if(match?.ends_at&&Date.now()>new Date(match.ends_at).getTime()+5000)return json({error:'match ended'},409);
   const sequence=Math.max(0,Number(body.sequence)||0),score=Math.max(0,Number(body.score)||0);if(sequence>membership.sequence)checked(await db.from('match_players').update({score,sequence,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('user_id',user.id).lt('sequence',sequence));return json({ok:true});
  }
  if(action==='heartbeat'){
   const sequence=Math.max(0,Number(body.sequence)||0),score=Math.max(0,Number(body.score)||0);if(sequence>=membership.sequence)await db.from('match_players').update({score:Math.max(membership.score,score),sequence,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('user_id',user.id);return json({ok:true,serverNow:new Date().toISOString()});
  }
  if(action==='leave'){
   await db.from('match_players').update({forfeited:true,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('user_id',user.id);const other=(await db.from('match_players').select('user_id').eq('match_id',matchId).neq('user_id',user.id).maybeSingle()).data;await db.from('matches').update({state:'finished',winner_id:other?.user_id??null}).eq('id',matchId);return json({ok:true});
  }
  if(action==='finalize'){
   const match=(await db.from('matches').select('*').eq('id',matchId).single()).data;if(match?.state==='finished'){const players=(await db.from('match_players').select('*').eq('match_id',matchId)).data??[];return json({match,participants:players})}if(!match?.ends_at||Date.now()<new Date(match.ends_at).getTime())return json({error:'too early'},409);const sequence=Math.max(membership.sequence,Number(body.sequence)||0),score=Math.max(membership.score,Number(body.score)||0);checked(await db.from('match_players').update({score,sequence,updated_at:new Date().toISOString()}).eq('match_id',matchId).eq('user_id',user.id));const players=checked(await db.from('match_players').select('*').eq('match_id',matchId)).data??[];const winner=players.length===2&&players[0].score!==players[1].score?(players[0].score>players[1].score?players[0]:players[1]).user_id:null;checked(await db.from('matches').update({state:'finished',winner_id:winner,finalized_at:new Date().toISOString(),finish_reason:winner?'score':'draw'}).eq('id',matchId).neq('state','finished'));return json({match:{...match,state:'finished',winner_id:winner},participants:players});
  }
  return json({error:'unknown action'},400);
 }catch(error){return json({error:error instanceof Error?error.message:'server error'},500)}
});
