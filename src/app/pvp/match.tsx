import React,{useCallback,useEffect,useRef,useState}from'react';
import{Alert,Animated,AppState,BackHandler,Platform,Pressable,Share,StyleSheet,Text,View}from'react-native';
import{router,useLocalSearchParams}from'expo-router';
import{Camera}from'expo-camera';
import{StatusBar}from'expo-status-bar';
import{Ionicons}from'@expo/vector-icons';
import{LinearGradient}from'expo-linear-gradient';
import*as Haptics from'expo-haptics';
import{useSafeAreaInsets}from'react-native-safe-area-context';
import{useKeepAwake}from'expo-keep-awake';
import CameraFeed,{type CameraEvent}from'../../CameraFeed';
import{AutomaticCounter}from'../../automatic';
import{useRepConfirmationSound}from'../../audio';
import{levelColor,ratingDeltaForOutcome,levelForRating,MIN_RATING}from'../../gamification';
import{broadcastScore,fetchPvpMatch,invokePvp,removeMatchChannel,subscribeToMatch,type PvpMatch}from'../../supabase';
import{useApp}from'../../state/AppContext';
import{colors,LevelBadge,PrimaryButton}from'../../ui';

type Phase='connecting'|'camera'|'countdown'|'active'|'finalizing'|'result';
const clock=(seconds:number)=>`00:${Math.max(0,seconds).toString().padStart(2,'0')}`;
function Awake(){useKeepAwake();return null}

export default function PvpMatchScreen(){
 const p=useLocalSearchParams<{matchId?:string;demo?:string;nickname?:string;opponent?:string;code?:string}>(),demo=p.demo==='1',insets=useSafeAreaInsets(),{recordSession,profile,history,gamification}=useApp();
 const playRepSound=useRepConfirmationSound(),nickname=p.nickname||profile.nickname||'Ты';
 const[phase,setPhase]=useState<Phase>('connecting'),[camera,setCamera]=useState(false),[poseReady,setPoseReady]=useState(false),[ready,setReady]=useState(false),[opponentReady,setOpponentReady]=useState(false),[score,setScore]=useState(0),[opponentScore,setOpponentScore]=useState(0),[opponentName,setOpponentName]=useState(p.opponent||'Соперник'),[remaining,setRemaining]=useState(60),[startAt,setStartAt]=useState(0),[endsAt,setEndsAt]=useState(0),[error,setError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[friendAdded,setFriendAdded]=useState(false),[prepSeconds,setPrepSeconds]=useState(45),[tracking,setTracking]=useState(false),[motionPhase,setMotionPhase]=useState<'down'|'up'>('down'),[pulse]=useState(()=>new Animated.Value(1)),[motion]=useState(()=>new Animated.Value(0)),[repBurst]=useState(()=>new Animated.Value(0));
 const engine=useRef(new AutomaticCounter()),stableSince=useRef(0),lastLegSeen=useRef(0),seq=useRef(0),scoreRef=useRef(0),finished=useRef(false),channel=useRef<ReturnType<typeof subscribeToMatch>>(null),finalResult=useRef<'win'|'loss'|'draw'|null>(null),lastHeartbeat=useRef(0);
 const ratingBefore=useRef(gamification.rating);

 const applyMatch=useCallback((match:PvpMatch)=>{
   const own=match.participants.find(item=>item.userId===profile.userId)||match.participants.find(item=>item.nickname===nickname);
   const other=match.participants.find(item=>item.userId!==own?.userId);
   if(own){scoreRef.current=Math.max(scoreRef.current,own.score);setScore(scoreRef.current);setReady(own.ready)}
   if(other){setOpponentName(other.nickname);setOpponentScore(other.score);setOpponentReady(other.ready)}
   if(match.state==='finished'||match.state==='cancelled'){finished.current=true;setRemaining(0);setCamera(false);setPhase('result');return}
   if(match.startAt){const start=+new Date(match.startAt),end=match.endsAt?+new Date(match.endsAt):start+60000;setStartAt(start);setEndsAt(end);setPhase(Date.now()<start?'countdown':'active');return}
   setPhase('camera');
 },[nickname,profile.userId]);

 useEffect(()=>{
   let active=true;
   void(async()=>{if(Platform.OS!=='web'){const permission=await Camera.requestCameraPermissionsAsync();if(!permission.granted){setError('Камера недоступна. Разреши доступ в настройках.');return}}if(active)setCamera(true)})();
   if(demo){const timer=setTimeout(()=>{setOpponentName(p.opponent||'Тестовый соперник');setPhase('camera')},0);return()=>{active=false;clearTimeout(timer)}};
   if(!p.matchId){const timer=setTimeout(()=>setError('Матч не найден.'),0);return()=>{active=false;clearTimeout(timer)}};
   channel.current=subscribeToMatch(p.matchId,(event,payload)=>{
     if(event==='score'&&payload?.score>=0)setOpponentScore((value)=>Math.max(value,payload.score));
     if(event==='match'&&payload){void fetchPvpMatch(p.matchId!).then(applyMatch).catch(()=>{})}
     if(event==='start'&&payload?.startAt){setStartAt(+new Date(payload.startAt));setEndsAt(+new Date(payload.endsAt||(+new Date(payload.startAt)+60000)));setPhase('countdown')}
   });
   const started=Date.now();
   const load=async()=>{try{const match=await fetchPvpMatch(p.matchId!);if(!active)return;setError('');applyMatch(match)}catch{if(active&&Date.now()-started>15000)setError('Не удалось подключиться к матчу.')}};
   void load();const poll=setInterval(()=>void load(),1000);
   return()=>{active=false;clearInterval(poll);void removeMatchChannel(channel.current)};
 },[applyMatch,demo,p.matchId,p.opponent]);

 useEffect(()=>{if(phase!=='camera'||ready)return;const started=Date.now(),timer=setInterval(()=>{const left=Math.max(0,45-Math.floor((Date.now()-started)/1000));setPrepSeconds(left);if(left===0){clearInterval(timer);setError('Время подготовки истекло.');}},250);return()=>clearInterval(timer)},[phase,ready]);

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
   if(!poseReady||ready||error)return;setReady(true);
   if(demo){setOpponentReady(true);const start=Date.now()+4000;setStartAt(start);setEndsAt(start+60000);setPhase('countdown');return}
   if(!p.matchId)return;
   try{const result=await invokePvp('ready',{matchId:p.matchId});if(result.match)applyMatch(result.match)}catch{setReady(false);setError('Не удалось отметить готовность.')}
 };

 const onEvent=useCallback((event:CameraEvent)=>{
   if(event.type==='error'){setError(event.message||'Камера недоступна');return}
   if(event.type!=='pose')return;
   const now=Date.now(),o=event.observation,valid=!!o&&o.confidence>=.55&&Number.isFinite(o.elbowAngle)&&o.armConfidence!>=.55;
   if(o?.feetVisible)lastLegSeen.current=now;
   const bodyTracked=valid&&now-lastLegSeen.current<=1500;
   if(phase==='camera'){
     const legsRecentlyVisible=now-lastLegSeen.current<=1500;
     if(valid&&legsRecentlyVisible){if(!stableSince.current)stableSince.current=now;const stable=now-stableSince.current>=800;setPoseReady(stable)}
     else{stableSince.current=0;setPoseReady(false)}
     return;
   }
   if(phase!=='active')return;
   const result=engine.current.update(valid?o!:null,now),counter=engine.current.counter;
   setTracking(Boolean(bodyTracked&&counter?.tracking));setMotionPhase(counter?.phase==='bottom'?'up':'down');
   motion.stopAnimation();Animated.timing(motion,{toValue:counter?.progress??0,duration:100,useNativeDriver:true}).start();
   if(result.rep){const next=counter!.count;scoreRef.current=next;setScore(next);seq.current++;void broadcastScore(channel.current,next,seq.current);if(p.matchId)void invokePvp('checkpoint',{matchId:p.matchId,score:next,sequence:seq.current,clientElapsedMs:now-startAt,sentAt:now}).catch(()=>{});void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});playRepSound();pulse.stopAnimation();repBurst.stopAnimation();repBurst.setValue(0);Animated.parallel([Animated.sequence([Animated.timing(pulse,{toValue:1.12,duration:70,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:150,useNativeDriver:true})]),Animated.sequence([Animated.timing(repBurst,{toValue:1,duration:110,useNativeDriver:true}),Animated.timing(repBurst,{toValue:0,duration:320,useNativeDriver:true})])]).start()}
 },[phase,p.matchId,startAt,playRepSound,pulse,motion,repBurst]);

 async function finishMatch(){
   setCamera(false);
   if(demo){setTimeout(()=>setPhase('result'),500);return}
   if(!p.matchId){setPhase('result');return}
   try{const result=await Promise.race([invokePvp('finalize',{matchId:p.matchId,score:scoreRef.current,sequence:seq.current}),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000))]);const other=result.participants?.find(item=>item.user_id!==profile.userId);if(other){setOpponentScore(other.score);setOpponentName(other.nickname)}}catch{setError('Результат сохранён по последней синхронизации.')}finally{setPhase('result')}
 }

 const outcome=score===opponentScore?'draw':score>opponentScore?'win':'loss',bestBefore=history.filter(item=>item.mode==='pvp').reduce((best,item)=>Math.max(best,item.reps),0),personalBest=score>bestBefore;
 const ratingDelta=ratingDeltaForOutcome(outcome),ratingAfter=Math.max(MIN_RATING,ratingBefore.current+ratingDelta),ratingLevelAfter=levelForRating(ratingAfter).level,ratingChange=ratingDelta>0?`+${ratingDelta}`:String(ratingDelta);
 const saveResult=useCallback(async()=>{if(saved)return;const result=finalResult.current??outcome,delta=ratingDeltaForOutcome(result);finalResult.current=result;await recordSession({id:`pvp-${p.matchId||startAt}`,matchId:p.matchId,date:new Date().toISOString(),reps:scoreRef.current,seconds:60,goal:0,mode:'pvp',pvpResult:result,ratingDelta:delta,ratingAfter:Math.max(MIN_RATING,ratingBefore.current+delta),opponentNickname:opponentName,synced:false});setSaved(true)},[saved,outcome,recordSession,p.matchId,startAt,opponentName]);
 useEffect(()=>{if(phase!=='result'||saved)return;const timer=setTimeout(()=>void saveResult().catch(()=>setError('Не удалось сохранить результат.')),0);return()=>clearTimeout(timer)},[phase,saved,saveResult]);

 async function leave(){if(p.matchId&&!demo)await invokePvp('leave',{matchId:p.matchId}).catch(()=>{});router.replace('/(tabs)/home')}
 function confirmLeave(){return phase==='active'||phase==='countdown'?Alert.alert('Выйти из матча?','Тебе будет засчитано поражение.',[{text:'Остаться',style:'cancel'},{text:'Выйти',style:'destructive',onPress:()=>void leave()}]):void leave()}
 const addFriend=async()=>{if(!p.matchId||demo)return;try{await invokePvp('add_friend',{matchId:p.matchId});setFriendAdded(true)}catch{setError('Не удалось добавить соперника.')}};
 const rematch=async()=>{if(saving)return;setSaving(true);try{await saveResult();if(demo){router.replace({pathname:'/pvp/match',params:{demo:'1',nickname,opponent:opponentName}});return}if(!p.matchId)throw new Error();const result=await invokePvp('rematch',{matchId:p.matchId});const matchId=result.matchId??result.match?.id;if(!matchId)throw new Error();router.replace({pathname:'/pvp/match',params:{matchId,nickname,code:result.code??result.match?.code??''}})}catch{setError('Не удалось создать реванш.');setSaving(false)}};

 if(phase==='result'){const title=outcome==='draw'?'Ничья':outcome==='win'?'Победа':'Поражение',outcomeColor=outcome==='win'?colors.win:outcome==='loss'?colors.loss:colors.draw;return <View style={[s.result,{paddingTop:insets.top+24,paddingBottom:insets.bottom+18}]}><StatusBar style="dark"/><View><Text style={[s.resultTitle,{color:outcomeColor}]}>{title}</Text>{personalBest?<Text style={s.record}>Личный рекорд</Text>:null}</View><View><View style={s.finalRow}><View style={s.finalSide}><Text style={s.who}>Ты</Text><Text style={[s.finalScore,{color:outcomeColor}]}>{score}</Text></View><Text style={s.dash}>—</Text><View style={s.finalSide}><Text numberOfLines={1} style={s.who}>{opponentName}</Text><Text style={s.finalScore}>{opponentScore}</Text></View></View><CardLite><View style={s.resultMetric}><View style={s.resultRating}><LevelBadge level={ratingLevelAfter} size={28}/><Text style={[s.resultMetricValue,{color:levelColor(ratingLevelAfter)}]}>{ratingAfter}</Text></View><Text style={s.resultMetricLabel}>PWR</Text></View><View style={s.resultMetric}><Text style={[s.resultMetricValue,ratingDelta>0?s.ratingUp:ratingDelta<0?s.ratingDown:null]}>{ratingChange}</Text><Text style={s.resultMetricLabel}>изменение PWR</Text></View></CardLite>{error?<Text style={s.resultError}>{error}</Text>:null}</View><View style={s.actions}><PrimaryButton title={saving?'Создаём…':'Реванш'} disabled={saving} onPress={()=>void rematch()}/>{!demo?<PrimaryButton title={friendAdded?'Добавлен в друзья':'Добавить в друзья'} tone="plain" disabled={friendAdded||saving} onPress={()=>void addFriend()}/>:null}<View style={s.resultRow}><Pressable style={s.smallAction} onPress={()=>router.replace('/pvp')}><Text style={s.smallActionText}>Найти другого</Text></Pressable><Pressable style={s.smallAction} onPress={()=>router.replace('/(tabs)/home')}><Text style={s.smallActionText}>Готово</Text></Pressable></View></View></View>}

 const countdownLabel=remaining>3?'Приготовься':String(remaining);
 return <View style={s.camera}><StatusBar hidden/>{camera?<Awake/>:null}<View style={StyleSheet.absoluteFill}>{camera?<CameraFeed onEvent={onEvent}/>:null}</View><LinearGradient pointerEvents="none" colors={['rgba(0,0,0,.82)','rgba(0,0,0,.34)','transparent']} locations={[0,.54,1]} style={s.topShade}/><LinearGradient pointerEvents="none" colors={['transparent','rgba(0,0,0,.26)','rgba(0,0,0,.72)']} locations={[0,.52,1]} style={s.bottomShade}/>
   <View style={[s.scoreboard,{top:insets.top+10}]}><View style={s.side}><Text style={s.name}>ТЫ</Text><Animated.Text style={[s.score,{transform:[{scale:pulse}]}]}>{score}</Animated.Text></View><View style={s.timer}><Text style={s.timerText}>{phase==='active'?clock(remaining):phase==='countdown'?countdownLabel:'—'}</Text></View><View style={[s.side,s.opponent]}><Text numberOfLines={1} style={s.name}>{opponentName.toUpperCase()}</Text><Text style={s.score}>{opponentScore}</Text></View></View>
   {phase==='active'?<MotionRail progress={motion} tracked={tracking} direction={motionPhase}/>:null}<Animated.View pointerEvents="none" style={[s.edgeFlash,{opacity:repBurst}]}/><Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.repBurst,{opacity:repBurst,transform:[{translateY:repBurst.interpolate({inputRange:[0,1],outputRange:[16,-26]})},{scale:repBurst.interpolate({inputRange:[0,1],outputRange:[.86,1.08]})}]}]}><Text style={s.repBurstNumber}>+1</Text><Text style={s.repBurstLabel}>ЗАСЧИТАНО</Text></Animated.View>
   <View style={s.center}>{phase==='countdown'?<Text style={remaining<=3?s.countdown:s.phase}>{countdownLabel}</Text>:phase==='connecting'||phase==='finalizing'?<Text style={s.phase}>{phase==='connecting'?'Подключаемся':'Проверяем результат'}</Text>:null}{phase==='camera'?<View style={s.cameraState}><View style={[s.stateDot,poseReady&&s.stateDotOn]}/><Text style={s.cameraStateText}>{ready?(opponentReady?'ОБА ГОТОВЫ':'ОЖИДАНИЕ'):poseReady?'В КАДРЕ':`ПОИСК · ${prepSeconds}`}</Text></View>:null}</View>
   <View style={[s.bottom,{bottom:Math.max(insets.bottom,14)}]}>{error?<Text style={s.error}>{error}</Text>:null}{phase==='camera'&&!ready?<Pressable disabled={!poseReady||!!error} onPress={()=>void submitReady()} style={[s.ready,!poseReady&&s.readyDisabled]}><Text style={s.readyText}>Готов</Text></Pressable>:null}{phase==='camera'&&ready?<View style={s.readyState}><Text style={s.readyStateText}>{opponentReady?'Матч начинается':'Ждём соперника'}</Text></View>:null}{phase==='camera'&&p.code?<Pressable style={s.share} onPress={()=>void Share.share({message:`Вызов в Rep: код ${p.code}`})}><Text style={s.shareText}>Поделиться кодом {p.code}</Text></Pressable>:null}{phase==='active'||phase==='countdown'?<Pressable accessibilityLabel="Выйти из матча" style={s.leaveCompact} onPress={confirmLeave}><Ionicons color="#fff" name="close" size={20}/></Pressable>:phase!=='finalizing'?<Pressable style={s.leave} onPress={confirmLeave}><Text style={s.leaveText}>Выйти</Text></Pressable>:null}</View>
 </View>
}
function MotionRail({progress,tracked,direction}:{progress:Animated.Value;tracked:boolean;direction:'down'|'up'}){const y=progress.interpolate({inputRange:[0,1],outputRange:[0,86],extrapolate:'clamp'});return <View style={[s.railShell,!tracked&&s.railShellLost]}><View style={s.rail}><View style={s.railLine}/><View style={[s.railEnd,s.railEndTop]}/><View style={[s.railEnd,s.railEndBottom]}/><Animated.View style={[s.railOrb,!tracked&&s.railOrbLost,{transform:[{translateY:y}]}]}><Ionicons color={tracked?'#07110D':'#fff'} name={tracked?(direction==='up'?'arrow-up':'arrow-down'):'scan-outline'} size={15}/></Animated.View></View></View>}
function CardLite({children}:{children:React.ReactNode}){return <View style={s.resultCard}>{children}</View>}
const s=StyleSheet.create({
 camera:{flex:1,backgroundColor:'#050706'},topShade:{position:'absolute',left:0,right:0,top:0,height:240},bottomShade:{position:'absolute',left:0,right:0,bottom:0,height:270},scoreboard:{position:'absolute',left:20,right:20,paddingTop:3,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},side:{width:'34%'},opponent:{alignItems:'flex-end'},name:{fontSize:10,color:'rgba(255,255,255,.68)',fontWeight:'800',letterSpacing:1,maxWidth:118,textShadowColor:'rgba(0,0,0,.45)',textShadowRadius:5},score:{fontSize:52,lineHeight:58,color:'#fff',fontWeight:'800',letterSpacing:-2,textShadowColor:'rgba(0,0,0,.48)',textShadowRadius:10},timer:{marginTop:13,backgroundColor:'rgba(8,12,11,.5)',borderRadius:18,paddingHorizontal:14,paddingVertical:8,minWidth:74,alignItems:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,.22)'},timerText:{fontSize:16,color:'#fff',fontWeight:'800',fontVariant:['tabular-nums']},center:{position:'absolute',top:'43%',alignSelf:'center',alignItems:'center'},phase:{color:'#fff',fontSize:18,fontWeight:'700',textShadowColor:'rgba(0,0,0,.65)',textShadowRadius:10},countdown:{color:'#fff',fontSize:92,lineHeight:100,fontWeight:'800',letterSpacing:-4,textShadowColor:'rgba(0,0,0,.56)',textShadowRadius:18},cameraState:{height:34,borderRadius:17,backgroundColor:'rgba(6,10,9,.5)',paddingHorizontal:13,flexDirection:'row',alignItems:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,.2)'},stateDot:{width:7,height:7,borderRadius:4,backgroundColor:'#FFD166',marginRight:8},stateDotOn:{backgroundColor:'#84F5C4'},cameraStateText:{color:'#fff',fontSize:10,fontWeight:'800',letterSpacing:.8},bottom:{position:'absolute',left:20,right:20,gap:9,alignItems:'stretch'},ready:{height:58,borderRadius:20,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},readyDisabled:{opacity:.35},readyText:{fontSize:17,fontWeight:'800'},readyState:{height:48,borderRadius:18,backgroundColor:'rgba(7,11,10,.5)',alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,.22)'},readyStateText:{color:'#fff',fontWeight:'700'},leave:{height:50,borderRadius:18,backgroundColor:'rgba(7,11,10,.42)',alignItems:'center',justifyContent:'center'},leaveCompact:{alignSelf:'center',width:44,height:44,borderRadius:22,backgroundColor:'rgba(7,11,10,.42)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,.25)',alignItems:'center',justifyContent:'center'},share:{height:44,borderRadius:17,backgroundColor:'rgba(7,11,10,.42)',alignItems:'center',justifyContent:'center'},shareText:{color:'rgba(255,255,255,.82)',fontSize:13,fontWeight:'600'},leaveText:{color:'rgba(255,255,255,.8)',fontSize:15,fontWeight:'700'},error:{color:'#fff',textAlign:'center',backgroundColor:'rgba(255,69,58,.82)',padding:9,borderRadius:12},railShell:{position:'absolute',right:18,top:'43%',width:46,height:126,borderRadius:23,backgroundColor:'rgba(5,10,9,.38)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},railShellLost:{borderColor:'rgba(255,209,102,.55)'},rail:{width:24,height:106,alignItems:'center'},railLine:{position:'absolute',top:8,bottom:8,width:2,borderRadius:1,backgroundColor:'rgba(255,255,255,.32)'},railEnd:{position:'absolute',width:7,height:7,borderRadius:4,backgroundColor:'rgba(255,255,255,.72)'},railEndTop:{top:5},railEndBottom:{bottom:5},railOrb:{position:'absolute',top:0,width:24,height:24,borderRadius:12,backgroundColor:'#84F5C4',alignItems:'center',justifyContent:'center',shadowColor:'#84F5C4',shadowOpacity:.7,shadowRadius:9,shadowOffset:{width:0,height:0}},railOrbLost:{backgroundColor:'#D29F3A',shadowColor:'#FFD166'},edgeFlash:{position:'absolute',left:0,right:0,top:0,bottom:0,borderWidth:3,borderColor:'#84F5C4'},repBurst:{position:'absolute',top:'33%',alignSelf:'center',alignItems:'center'},repBurstNumber:{color:'#fff',fontSize:72,lineHeight:78,fontWeight:'800',letterSpacing:-4,textShadowColor:'#43E59B',textShadowRadius:18},repBurstLabel:{color:'#B9FFE1',fontSize:10,fontWeight:'800',letterSpacing:2},
 result:{flex:1,backgroundColor:colors.bg,paddingHorizontal:20,justifyContent:'space-between'},resultTitle:{fontSize:42,fontWeight:'800',letterSpacing:-1.5},record:{fontSize:14,color:colors.green,fontWeight:'700',marginTop:4},finalRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-around'},finalSide:{width:'38%',alignItems:'center'},who:{fontSize:12,color:colors.secondary,textAlign:'center',fontWeight:'700',maxWidth:120},finalScore:{fontSize:80,fontWeight:'800',letterSpacing:-4},dash:{fontSize:30,color:colors.tertiary},resultCard:{backgroundColor:'#fff',borderRadius:20,padding:18,flexDirection:'row',marginTop:20},resultMetric:{flex:1,alignItems:'center'},resultRating:{flexDirection:'row',alignItems:'center',gap:8},resultMetricValue:{fontSize:24,fontWeight:'800'},ratingUp:{color:colors.green},ratingDown:{color:colors.red},resultMetricLabel:{fontSize:10,color:colors.secondary,marginTop:3},resultError:{fontSize:12,color:colors.red,textAlign:'center',marginTop:10},actions:{gap:9},resultRow:{flexDirection:'row',gap:9},smallAction:{flex:1,height:50,borderRadius:17,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},smallActionText:{color:colors.blue,fontSize:14,fontWeight:'700'}
});
