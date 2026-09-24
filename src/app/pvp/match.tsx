import React,{useCallback,useEffect,useRef,useState}from'react';
import{Alert,Animated,AppState,BackHandler,Platform,Pressable,Share,StyleSheet,Text,View}from'react-native';
import{router,useLocalSearchParams}from'expo-router';
import{Camera}from'expo-camera';
import{StatusBar}from'expo-status-bar';
import*as Haptics from'expo-haptics';
import{useSafeAreaInsets}from'react-native-safe-area-context';
import{useKeepAwake}from'expo-keep-awake';
import CameraFeed,{type CameraEvent}from'../../CameraFeed';
import{AutomaticCounter}from'../../automatic';
import{useRepConfirmationSound}from'../../audio';
import{broadcastScore,fetchPvpMatch,invokePvp,removeMatchChannel,subscribeToMatch,type PvpMatch}from'../../supabase';
import{useApp}from'../../state/AppContext';
import{colors,PrimaryButton}from'../../ui';

type Phase='connecting'|'camera'|'countdown'|'active'|'finalizing'|'result';
const clock=(seconds:number)=>`00:${Math.max(0,seconds).toString().padStart(2,'0')}`;
function Awake(){useKeepAwake();return null}

export default function PvpMatchScreen(){
 const p=useLocalSearchParams<{matchId?:string;demo?:string;nickname?:string;opponent?:string;code?:string}>(),demo=p.demo==='1',insets=useSafeAreaInsets(),{recordSession,profile,history,gamification}=useApp();
 const playRepSound=useRepConfirmationSound(),nickname=p.nickname||profile.nickname||'Ты';
 const[phase,setPhase]=useState<Phase>('connecting'),[camera,setCamera]=useState(false),[poseReady,setPoseReady]=useState(false),[ready,setReady]=useState(false),[opponentReady,setOpponentReady]=useState(false),[hint,setHint]=useState('Подключаемся'),[score,setScore]=useState(0),[opponentScore,setOpponentScore]=useState(0),[opponentName,setOpponentName]=useState(p.opponent||'Соперник'),[remaining,setRemaining]=useState(60),[startAt,setStartAt]=useState(0),[endsAt,setEndsAt]=useState(0),[error,setError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[friendAdded,setFriendAdded]=useState(false),[prepSeconds,setPrepSeconds]=useState(45),[pulse]=useState(()=>new Animated.Value(1));
 const engine=useRef(new AutomaticCounter()),stableSince=useRef(0),lastLegSeen=useRef(0),seq=useRef(0),scoreRef=useRef(0),finished=useRef(false),channel=useRef<ReturnType<typeof subscribeToMatch>>(null),finalResult=useRef<'win'|'loss'|'draw'|null>(null),lastHeartbeat=useRef(0);

 const applyMatch=useCallback((match:PvpMatch)=>{
   const own=match.participants.find(item=>item.userId===profile.userId)||match.participants.find(item=>item.nickname===nickname);
   const other=match.participants.find(item=>item.userId!==own?.userId);
   if(own){scoreRef.current=Math.max(scoreRef.current,own.score);setScore(scoreRef.current);setReady(own.ready)}
   if(other){setOpponentName(other.nickname);setOpponentScore(other.score);setOpponentReady(other.ready)}
   if(match.state==='finished'||match.state==='cancelled'){finished.current=true;setRemaining(0);setCamera(false);setPhase('result');return}
   if(match.startAt){const start=+new Date(match.startAt),end=match.endsAt?+new Date(match.endsAt):start+60000;setStartAt(start);setEndsAt(end);setPhase(Date.now()<start?'countdown':'active');return}
   setPhase('camera');setHint(match.participants.length<2?'Ждём соперника':'Встань в упор');
 },[nickname,profile.userId]);

 useEffect(()=>{
   let active=true;
   void(async()=>{if(Platform.OS!=='web'){const permission=await Camera.requestCameraPermissionsAsync();if(!permission.granted){setError('Камера недоступна. Разреши доступ в настройках.');return}}if(active)setCamera(true)})();
   if(demo){const timer=setTimeout(()=>{setOpponentName(p.opponent||'Тестовый соперник');setPhase('camera');setHint('Встань в упор')},0);return()=>{active=false;clearTimeout(timer)}};
   if(!p.matchId){const timer=setTimeout(()=>setError('Матч не найден.'),0);return()=>{active=false;clearTimeout(timer)}};
   channel.current=subscribeToMatch(p.matchId,(event,payload)=>{
     if(event==='score'&&payload?.score>=0)setOpponentScore((value)=>Math.max(value,payload.score));
     if(event==='match'&&payload){void fetchPvpMatch(p.matchId!).then(applyMatch).catch(()=>{})}
     if(event==='start'&&payload?.startAt){setStartAt(+new Date(payload.startAt));setEndsAt(+new Date(payload.endsAt||(+new Date(payload.startAt)+60000)));setPhase('countdown')}
   });
   const started=Date.now();
   const load=async()=>{try{const match=await fetchPvpMatch(p.matchId!);if(!active)return;setError('');applyMatch(match)}catch{if(active&&Date.now()-started>3000)setHint('Проверяем соединение');if(active&&Date.now()-started>15000)setError('Не удалось подключиться к матчу.')}};
   void load();const poll=setInterval(()=>void load(),1000);
   return()=>{active=false;clearInterval(poll);void removeMatchChannel(channel.current)};
 },[applyMatch,demo,p.matchId,p.opponent]);

 useEffect(()=>{if(phase!=='camera'||ready)return;const started=Date.now(),timer=setInterval(()=>{const left=Math.max(0,45-Math.floor((Date.now()-started)/1000));setPrepSeconds(left);if(left===15)setHint('Встань в рамку и нажми «Готов»');if(left===0){clearInterval(timer);setError('Время подготовки истекло.');}},250);return()=>clearInterval(timer)},[phase,ready]);

 useEffect(()=>{if(!startAt)return;finished.current=false;const timer=setInterval(()=>{
   const now=Date.now();
   if(now<startAt){setPhase('countdown');setRemaining(Math.ceil((startAt-now)/1000));return}
   const end=endsAt||startAt+60000,left=Math.ceil((end-now)/1000);
   if(left>0){setPhase('active');setRemaining(left);if(demo)setOpponentScore(Math.min(14,Math.floor((60-left)/4.3)));return}
   if(finished.current)return;finished.current=true;setRemaining(0);setPhase('finalizing');void finishMatch();
 },80);return()=>clearInterval(timer)},[startAt,endsAt,demo]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(()=>{if(phase!=='active'||demo||!p.matchId)return;const timer=setInterval(()=>{const now=Date.now();lastHeartbeat.current=now;void invokePvp('heartbeat',{matchId:p.matchId,score:scoreRef.current,sequence:seq.current,clientElapsedMs:Math.max(0,now-startAt)}).catch(()=>{})},1000);return()=>clearInterval(timer)},[phase,demo,p.matchId,startAt]);

 useEffect(()=>{const sub=AppState.addEventListener('change',next=>{if(next==='background')setCamera(false);if(next==='active')setCamera(true)});return()=>sub.remove()},[]);
 // The handler only needs to update when the visible match phase changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{const handler=()=>{if(phase==='active'||phase==='countdown'){confirmLeave();return true}return false};const back=BackHandler.addEventListener('hardwareBackPress',handler);return()=>back.remove()},[phase]);

 const submitReady=async()=>{
   if(!poseReady||ready||error)return;setReady(true);setHint('Ждём готовность соперника');
   if(demo){setOpponentReady(true);const start=Date.now()+4000;setStartAt(start);setEndsAt(start+60000);setPhase('countdown');return}
   if(!p.matchId)return;
   try{const result=await invokePvp('ready',{matchId:p.matchId});if(result.match)applyMatch(result.match)}catch{setReady(false);setError('Не удалось отметить готовность.')}
 };

 const onEvent=useCallback((event:CameraEvent)=>{
   if(event.type==='error'){setError(event.message||'Камера недоступна');return}
   if(event.type!=='pose')return;
   const o=event.observation,valid=!!o&&o.confidence>=.55&&Number.isFinite(o.elbowAngle)&&o.armConfidence!>=.55;
   if(phase==='camera'){
     const now=Date.now();
     if(o?.legsVisible)lastLegSeen.current=now;
     const legsRecentlyVisible=now-lastLegSeen.current<=1500;
     if(valid&&legsRecentlyVisible){if(!stableSince.current)stableSince.current=now;const stable=now-stableSince.current>=800;setPoseReady(stable);setHint(stable?'Можно начинать':'Не двигайся секунду')}
     else{stableSince.current=0;setPoseReady(false);setHint(!valid?'Встань в упор':'Покажи стопы')}
     return;
   }
   if(phase!=='active')return;
   const result=engine.current.update(valid?o!:null,Date.now());
   if(!valid)setHint('Вернись в кадр');else if(engine.current.counter?.needsFeet)setHint('Покажи стопы');else if(engine.current.counter?.needsBodyMovement)setHint('Опускайся');else setHint(engine.current.counter?.phase==='bottom'?'Выпрями руки':'Опускайся');
   if(result.rep){const next=engine.current.counter!.count;scoreRef.current=next;setScore(next);seq.current++;void broadcastScore(channel.current,next,seq.current);if(p.matchId)void invokePvp('checkpoint',{matchId:p.matchId,score:next,sequence:seq.current,clientElapsedMs:Date.now()-startAt,sentAt:Date.now()}).catch(()=>{});void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});playRepSound();Animated.sequence([Animated.timing(pulse,{toValue:1.12,duration:70,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:150,useNativeDriver:true})]).start()}
 },[phase,p.matchId,startAt,playRepSound,pulse]);

 async function finishMatch(){
   setCamera(false);
   if(demo){setTimeout(()=>setPhase('result'),500);return}
   if(!p.matchId){setPhase('result');return}
   try{const result=await Promise.race([invokePvp('finalize',{matchId:p.matchId,score:scoreRef.current,sequence:seq.current}),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000))]);const other=result.participants?.find(item=>item.user_id!==profile.userId);if(other){setOpponentScore(other.score);setOpponentName(other.nickname)}}catch{setError('Результат сохранён по последней синхронизации.')}finally{setPhase('result')}
 }

 const outcome=score===opponentScore?'draw':score>opponentScore?'win':'loss',bestBefore=history.filter(item=>item.mode==='pvp').reduce((best,item)=>Math.max(best,item.reps),0),personalBest=score>bestBefore;
 const earned=20+(outcome==='win'?10:outcome==='draw'?5:0)+(personalBest&&bestBefore>0?20:0);
 const saveResult=useCallback(async()=>{if(saved)return;const result=finalResult.current??outcome;finalResult.current=result;await recordSession({id:`pvp-${p.matchId||startAt}`,matchId:p.matchId,date:new Date().toISOString(),reps:scoreRef.current,seconds:60,goal:0,mode:'pvp',pvpResult:result,opponentNickname:opponentName,synced:false});setSaved(true)},[saved,outcome,recordSession,p.matchId,startAt,opponentName]);
 useEffect(()=>{if(phase!=='result'||saved)return;const timer=setTimeout(()=>void saveResult().catch(()=>setError('Не удалось сохранить результат.')),0);return()=>clearTimeout(timer)},[phase,saved,saveResult]);

 async function leave(){if(p.matchId&&!demo)await invokePvp('leave',{matchId:p.matchId}).catch(()=>{});router.replace('/(tabs)/home')}
 function confirmLeave(){return phase==='active'||phase==='countdown'?Alert.alert('Выйти из матча?','Тебе будет засчитано поражение.',[{text:'Остаться',style:'cancel'},{text:'Выйти',style:'destructive',onPress:()=>void leave()}]):void leave()}
 const addFriend=async()=>{if(!p.matchId||demo)return;try{await invokePvp('add_friend',{matchId:p.matchId});setFriendAdded(true)}catch{setError('Не удалось добавить соперника.')}};
 const rematch=async()=>{if(saving)return;setSaving(true);try{await saveResult();if(demo){router.replace({pathname:'/pvp/match',params:{demo:'1',nickname,opponent:opponentName}});return}if(!p.matchId)throw new Error();const result=await invokePvp('rematch',{matchId:p.matchId});const matchId=result.matchId??result.match?.id;if(!matchId)throw new Error();router.replace({pathname:'/pvp/match',params:{matchId,nickname,code:result.code??result.match?.code??''}})}catch{setError('Не удалось создать реванш.');setSaving(false)}};

 if(phase==='result'){const title=outcome==='draw'?'Ничья':outcome==='win'?'Победа':'Поражение';return <View style={[s.result,{paddingTop:insets.top+24,paddingBottom:insets.bottom+18}]}><StatusBar style="dark"/><View><Text style={s.resultTitle}>{title}</Text>{personalBest?<Text style={s.record}>Личный рекорд</Text>:null}</View><View><View style={s.finalRow}><View style={s.finalSide}><Text style={s.who}>Ты</Text><Text style={s.finalScore}>{score}</Text></View><Text style={s.dash}>—</Text><View style={s.finalSide}><Text numberOfLines={1} style={s.who}>{opponentName}</Text><Text style={s.finalScore}>{opponentScore}</Text></View></View><CardLite><View style={s.resultMetric}><Text style={s.resultMetricValue}>{Math.max(score,bestBefore)}</Text><Text style={s.resultMetricLabel}>лучший за минуту</Text></View><View style={s.resultMetric}><Text style={s.resultMetricValue}>+{earned}</Text><Text style={s.resultMetricLabel}>очков · ур. {gamification.level}</Text></View></CardLite>{error?<Text style={s.resultError}>{error}</Text>:null}</View><View style={s.actions}><PrimaryButton title={saving?'Создаём…':'Реванш'} disabled={saving} onPress={()=>void rematch()}/>{!demo?<PrimaryButton title={friendAdded?'Добавлен в друзья':'Добавить в друзья'} tone="plain" disabled={friendAdded||saving} onPress={()=>void addFriend()}/>:null}<View style={s.resultRow}><Pressable style={s.smallAction} onPress={()=>router.replace('/pvp')}><Text style={s.smallActionText}>Найти другого</Text></Pressable><Pressable style={s.smallAction} onPress={()=>router.replace('/(tabs)/home')}><Text style={s.smallActionText}>Готово</Text></Pressable></View></View></View>}

 const countdownLabel=remaining>3?'Приготовься':String(remaining);
 return <View style={s.camera}><StatusBar hidden/>{camera?<Awake/>:null}{camera?<CameraFeed onEvent={onEvent}/>:null}<View style={[s.scoreboard,{top:insets.top+14}]}><View style={s.side}><Text style={s.name}>ТЫ</Text><Animated.Text style={[s.score,{transform:[{scale:pulse}]}]}>{score}</Animated.Text></View><View style={s.timer}><Text style={s.timerText}>{phase==='active'?clock(remaining):phase==='countdown'?countdownLabel:'—'}</Text></View><View style={[s.side,s.opponent]}><Text numberOfLines={1} style={s.name}>{opponentName.toUpperCase()}</Text><Text style={s.score}>{opponentScore}</Text></View></View>
   <View style={s.center}><Text style={s.phase}>{phase==='connecting'?'Подключаемся':phase==='countdown'?countdownLabel:phase==='finalizing'?'Проверяем результат':hint}</Text>{phase==='camera'&&opponentReady?<Text style={s.opponentState}>Соперник готов</Text>:null}{phase==='camera'&&!ready?<Text style={s.prep}>{prepSeconds} сек</Text>:null}</View>
   <View style={[s.bottom,{bottom:Math.max(insets.bottom,16)}]}>{error?<Text style={s.error}>{error}</Text>:null}{phase==='camera'&&!ready?<Pressable disabled={!poseReady||!!error} onPress={()=>void submitReady()} style={[s.ready,!poseReady&&s.readyDisabled]}><Text style={s.readyText}>Готов</Text></Pressable>:null}{phase==='camera'&&ready?<View style={s.readyState}><Text style={s.readyStateText}>Ты готов · {opponentReady?'соперник готов':'ждём соперника'}</Text></View>:null}{phase==='camera'&&p.code?<Pressable style={s.share} onPress={()=>void Share.share({message:`Вызов в Rep: код ${p.code}`})}><Text style={s.leaveText}>Поделиться кодом {p.code}</Text></Pressable>:null}<Pressable style={s.leave} onPress={confirmLeave}><Text style={s.leaveText}>Выйти</Text></Pressable></View>
 </View>
}
function CardLite({children}:{children:React.ReactNode}){return <View style={s.resultCard}>{children}</View>}
const s=StyleSheet.create({
 camera:{flex:1,backgroundColor:'#050505'},scoreboard:{position:'absolute',left:14,right:14,backgroundColor:'rgba(0,0,0,.64)',borderRadius:22,padding:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},side:{width:'33%'},opponent:{alignItems:'flex-end'},name:{fontSize:10,color:'#C7C7CC',fontWeight:'700',maxWidth:105},score:{fontSize:42,lineHeight:47,color:'#fff',fontWeight:'800'},timer:{backgroundColor:'#fff',borderRadius:18,paddingHorizontal:12,paddingVertical:8,minWidth:70,alignItems:'center'},timerText:{fontSize:17,fontWeight:'800'},center:{position:'absolute',top:'44%',alignSelf:'center',alignItems:'center'},phase:{color:'#fff',fontSize:19,fontWeight:'700',backgroundColor:'rgba(0,0,0,.6)',paddingHorizontal:18,paddingVertical:11,borderRadius:22,overflow:'hidden'},opponentState:{color:'#fff',fontSize:12,marginTop:8},prep:{color:'#C7C7CC',fontSize:12,marginTop:5},bottom:{position:'absolute',left:20,right:20,gap:9},ready:{height:58,borderRadius:20,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},readyDisabled:{opacity:.38},readyText:{fontSize:17,fontWeight:'800'},readyState:{height:48,borderRadius:18,backgroundColor:'rgba(0,0,0,.62)',alignItems:'center',justifyContent:'center'},readyStateText:{color:'#fff',fontWeight:'700'},leave:{height:52,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,.58)',backgroundColor:'rgba(0,0,0,.4)',alignItems:'center',justifyContent:'center'},share:{height:46,borderRadius:18,backgroundColor:'rgba(0,0,0,.62)',alignItems:'center',justifyContent:'center'},leaveText:{color:'#fff',fontSize:15,fontWeight:'700'},error:{color:'#fff',textAlign:'center',backgroundColor:'rgba(255,69,58,.8)',padding:9,borderRadius:12},
 result:{flex:1,backgroundColor:colors.bg,paddingHorizontal:20,justifyContent:'space-between'},resultTitle:{fontSize:42,fontWeight:'800',letterSpacing:-1.5},record:{fontSize:14,color:colors.green,fontWeight:'700',marginTop:4},finalRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-around'},finalSide:{width:'38%',alignItems:'center'},who:{fontSize:12,color:colors.secondary,textAlign:'center',fontWeight:'700',maxWidth:120},finalScore:{fontSize:80,fontWeight:'800',letterSpacing:-4},dash:{fontSize:30,color:colors.tertiary},resultCard:{backgroundColor:'#fff',borderRadius:20,padding:18,flexDirection:'row',marginTop:20},resultMetric:{flex:1,alignItems:'center'},resultMetricValue:{fontSize:24,fontWeight:'800'},resultMetricLabel:{fontSize:10,color:colors.secondary,marginTop:3},resultError:{fontSize:12,color:colors.red,textAlign:'center',marginTop:10},actions:{gap:9},resultRow:{flexDirection:'row',gap:9},smallAction:{flex:1,height:50,borderRadius:17,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},smallActionText:{color:colors.blue,fontSize:14,fontWeight:'700'}
});
