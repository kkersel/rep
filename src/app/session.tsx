import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppState, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraFeed, { type CameraEvent } from '../CameraFeed';
import { AutomaticCounter } from '../automatic';
import { useRepConfirmationSound } from '../audio';
import type { SessionKind } from '../data';
import { useApp } from '../state/AppContext';
import { colors, PrimaryButton } from '../ui';

type SessionState='finding'|'active'|'paused'|'result';
const clock=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
function Awake(){useKeepAwake();return null}

export default function SessionScreen(){
  const params=useLocalSearchParams<{kind?:string;goal?:string;day?:string}>(), insets=useSafeAreaInsets(), {recordSession}=useApp();
  const playRepSound=useRepConfirmationSound();
  const kind:SessionKind=params.kind==='program'?'program':params.kind==='light'?'light':'free', goal=Math.max(0,Number(params.goal)||0), programDay=Number(params.day)||undefined;
  const [state,setState]=useState<SessionState>('finding'), stateRef=useRef<SessionState>('finding');
  const [camera,setCamera]=useState(false),[ready,setReady]=useState(false),[visible,setVisible]=useState(false),[status,setStatus]=useState('Запускаем камеру…');
  const [count,setCount]=useState(0),[seconds,setSeconds]=useState(0),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const engine=useRef(new AutomaticCounter()),startAt=useRef(0),elapsed=useRef(0),lastFrame=useRef(0),sessionId=`session-${useId()}`,[pulse]=useState(()=>new Animated.Value(1));
  const change=(next:SessionState)=>{stateRef.current=next;setState(next)};
  const pause=useCallback(()=>{if(stateRef.current==='active'){elapsed.current+=Date.now()-startAt.current;setSeconds(Math.floor(elapsed.current/1000));engine.current.counter?.resetTracking();change('paused')}},[]);

  useEffect(()=>{void (async()=>{if(Platform.OS!=='web'){const p=await Camera.requestCameraPermissionsAsync();if(!p.granted){setError('Разреши камеру в настройках телефона.');return}}setCamera(true)})();
    const app=AppState.addEventListener('change',next=>{if(next==='background')pause()});
    const timer=setInterval(()=>{if(stateRef.current==='active')setSeconds(Math.floor((elapsed.current+Date.now()-startAt.current)/1000));if(Date.now()-lastFrame.current>1500){setVisible(false);engine.current.update(null,Date.now())}},200);
    return()=>{app.remove();clearInterval(timer)};
  },[pause]);

  const onEvent=useCallback((event:CameraEvent)=>{
    if(event.type==='ready'){setReady(true);setStatus('Покажи себя целиком')}
    if(event.type==='status')setStatus('Загружаем распознавание…');
    if(event.type==='error'){setError(event.message??'Камера недоступна');pause();return}
    if(event.type!=='pose')return;
    const now=Date.now(),o=event.observation??null;lastFrame.current=now;
    const valid=!!o&&o.confidence>=.55&&Number.isFinite(o.elbowAngle)&&Number.isFinite(o.armConfidence)&&o.armConfidence!>=.55;
    setVisible(valid);
    if(stateRef.current!=='finding'&&stateRef.current!=='active')return;
    const result=engine.current.update(valid?o:null,now);
    if(!valid)setStatus(stateRef.current==='active'?'Вернись в кадр':'Покажи себя целиком');
    else if(engine.current.counter?.needsFeet)setStatus('Покажи стопы');
    else if(engine.current.counter?.needsBodyMovement)setStatus('Опусти корпус');
    else if(engine.current.counter?.phase==='bottom')setStatus('Вверх');
    else if(engine.current.counter?.phase==='seek-top')setStatus('Выпрями руки');
    else setStatus('Опускайся');
    if(result.started){startAt.current=now;change('active')}
    if(result.rep){const next=engine.current.counter!.count;setCount(next);playRepSound();void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});Animated.sequence([Animated.timing(pulse,{toValue:1.1,duration:80,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:160,useNativeDriver:true})]).start()}
  },[pause,playRepSound,pulse]);

  const finish=()=>{if(stateRef.current==='active')elapsed.current+=Date.now()-startAt.current;setSeconds(Math.floor(elapsed.current/1000));setCamera(false);change('result')};
  const save=async()=>{if(saving)return;setSaving(true);try{await recordSession({id:sessionId,date:new Date().toISOString(),reps:count,seconds,goal,mode:kind,programDay,synced:false});router.replace('/(tabs)/home')}catch{setError('Не удалось сохранить. Попробуй ещё раз.')}finally{setSaving(false)}};
  if(state==='result')return <View style={[s.result,{paddingTop:insets.top+24,paddingBottom:insets.bottom+20}]}><StatusBar style="dark"/><Text style={s.logo}>Rep</Text><View style={s.resultCenter}><Text style={s.resultKicker}>{goal>0&&count>=goal?'Цель выполнена':kind==='free'?'Свободный подход':`Осталось ${Math.max(0,goal-count)}`}</Text><Text style={s.resultNumber}>{count}</Text><Text style={s.resultUnit}>отжиманий · {clock(seconds)}</Text></View><View style={s.resultActions}><PrimaryButton title={saving?'Сохраняем…':'Сохранить'} disabled={saving} onPress={()=>void save()}/><PrimaryButton title="Без сохранения" tone="plain" disabled={saving} onPress={()=>router.replace('/(tabs)/home')}/>{error?<Text style={s.error}>{error}</Text>:null}</View></View>;
  const progress=goal?Math.min(1,count/goal):0;
 return <View style={s.camera}><StatusBar hidden/>{camera?<Awake/>:null}<View style={StyleSheet.absoluteFill}>{camera?<CameraFeed onEvent={onEvent}/>:null}</View><LinearGradient pointerEvents="none" colors={['rgba(0,0,0,.72)','transparent']} style={s.shade}/><View style={[s.top,{top:insets.top+12}]}><View style={s.live}><View style={[s.dot,visible&&s.dotOn]}/><Text style={s.liveText}>{kind==='program'||kind==='light'?`${count} / ${goal}`:'СВОБОДНЫЙ'}</Text></View><Animated.Text style={[s.count,{transform:[{scale:pulse}]}]}>{String(count).padStart(2,'0')}</Animated.Text><Text style={s.time}>{clock(seconds)}</Text></View><View pointerEvents="none" style={[s.hint,{top:insets.top+150}]}><Text style={s.hintText}>{!ready?'Запускаем камеру…':status}</Text>{goal>0?<View style={s.progress}><View style={[s.progressFill,{width:`${progress*100}%`}]}/></View>:null}</View><View style={[s.controls,{bottom:Math.max(insets.bottom,16)}]}>{error?<Text style={s.cameraError}>{error}</Text>:null}<View style={s.row}>{state==='paused'?<><Control title="Продолжить" primary onPress={()=>{engine.current.counter?.resetTracking();startAt.current=Date.now();change('active')}}/><Control title="Завершить" onPress={finish}/></>:state==='active'?<><Control title="Пауза" onPress={pause}/><Control title="Завершить" primary onPress={finish}/></>:<Control title="Отмена" onPress={()=>router.back()}/>}</View></View></View>;
}
function Control({title,onPress,primary=false}:{title:string;onPress:()=>void;primary?:boolean}){return <Pressable onPress={onPress} style={[s.control,primary&&s.controlPrimary]}><Text style={[s.controlText,primary&&s.controlPrimaryText]}>{title}</Text></Pressable>}
const s=StyleSheet.create({camera:{flex:1,backgroundColor:'#060806'},shade:{position:'absolute',left:0,right:0,top:0,height:260},top:{position:'absolute',left:22,right:22,alignItems:'flex-start'},live:{height:34,borderRadius:17,backgroundColor:'rgba(0,0,0,.52)',paddingHorizontal:13,flexDirection:'row',alignItems:'center'},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#777',marginRight:8},dotOn:{backgroundColor:colors.green},liveText:{color:'#fff',fontSize:12,fontWeight:'700'},count:{fontSize:80,lineHeight:88,fontWeight:'800',color:'#fff',letterSpacing:-4,marginTop:3},time:{fontSize:15,color:'#fff'},hint:{position:'absolute',alignSelf:'center',alignItems:'center'},hintText:{color:'#fff',fontSize:15,fontWeight:'600',backgroundColor:'rgba(0,0,0,.55)',paddingHorizontal:15,paddingVertical:9,borderRadius:18,overflow:'hidden'},progress:{width:180,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,.3)',marginTop:10,overflow:'hidden'},progressFill:{height:4,backgroundColor:'#fff'},controls:{position:'absolute',left:20,right:20},row:{flexDirection:'row',gap:10},control:{flex:1,height:58,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,.55)',backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',justifyContent:'center'},controlPrimary:{backgroundColor:'#fff',borderColor:'#fff'},controlText:{fontSize:17,fontWeight:'700',color:'#fff'},controlPrimaryText:{color:'#000'},cameraError:{color:'#fff',textAlign:'center',marginBottom:10},result:{flex:1,backgroundColor:colors.bg,paddingHorizontal:22,justifyContent:'space-between'},logo:{fontSize:24,fontWeight:'800'},resultCenter:{alignItems:'center'},resultKicker:{fontSize:16,color:colors.secondary,fontWeight:'700'},resultNumber:{fontSize:136,lineHeight:150,fontWeight:'800',letterSpacing:-8},resultUnit:{fontSize:17,color:colors.secondary},resultActions:{gap:10},error:{textAlign:'center',color:colors.red,fontSize:13},
});
