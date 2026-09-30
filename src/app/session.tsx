import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraFeed, { type CameraEvent, type CameraFeedHandle } from '../CameraFeed';
import { AutomaticCounter } from '../automatic';
import { useRepConfirmationSound } from '../audio';
import { askCoach, loadCoachMessages, saveCoachMessages, type CoachMessage } from '../coach';
import { isCoachLessonId } from '../coachLessons';
import { summarizePoseTrace } from '../coachEngineMetrics';
import type { SessionKind, WorkoutTechniqueAssessment } from '../data';
import { TechniqueLessonCard } from '../TechniqueLessonCard';
import { useApp } from '../state/AppContext';
import { colors, PrimaryButton } from '../ui';

 type SessionState='finding'|'active'|'paused'|'analyzing'|'result';
const clock=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
function Awake(){useKeepAwake();return null}

export default function SessionScreen(){
  const params=useLocalSearchParams<{kind?:string;goal?:string;day?:string}>(), insets=useSafeAreaInsets(), {recordSession,profile,program}=useApp();
  const playRepSound=useRepConfirmationSound();
  const kind:SessionKind=params.kind==='program'?'program':params.kind==='light'?'light':'free', goal=Math.max(0,Number(params.goal)||0), programDay=Number(params.day)||undefined;
  const [state,setState]=useState<SessionState>('finding'), stateRef=useRef<SessionState>('finding');
  const [camera,setCamera]=useState(false),[cameraKey,setCameraKey]=useState(0),[visible,setVisible]=useState(false);
  const [count,setCount]=useState(0),[seconds,setSeconds]=useState(0),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [assessment,setAssessment]=useState<WorkoutTechniqueAssessment|null>(null),[analysisError,setAnalysisError]=useState('');
  const engine=useRef(new AutomaticCounter()),cameraFeed=useRef<CameraFeedHandle>(null),captureStarted=useRef(false),analysisStarted=useRef(false),analysisTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const startAt=useRef(0),elapsed=useRef(0),lastFrame=useRef(0),finalSeconds=useRef(0),sessionId=`session-${useId()}`,[pulse]=useState(()=>new Animated.Value(1));
  const change=(next:SessionState)=>{stateRef.current=next;setState(next)};
  const pause=useCallback(()=>{if(stateRef.current==='active'){elapsed.current+=Date.now()-startAt.current;setSeconds(Math.floor(elapsed.current/1000));engine.current.counter?.resetTracking();cameraFeed.current?.pauseCapture();change('paused')}},[]);

  const restartCamera=useCallback(()=>{
    setError('');setVisible(false);setCamera(false);captureStarted.current=false;
    setTimeout(()=>{setCameraKey(value=>value+1);setCamera(true)},180);
  },[]);

  useFocusEffect(useCallback(()=>{
    let active=true;
    setError('');setVisible(false);setCamera(false);
    const start=setTimeout(()=>{void (async()=>{
      if(Platform.OS!=='web'){
        const current=await Camera.getCameraPermissionsAsync();
        const permission=current.granted?current:await Camera.requestCameraPermissionsAsync();
        if(!permission.granted){if(active)setError('Разреши камеру в настройках телефона.');return}
      }
      if(active){setCameraKey(value=>value+1);setCamera(true)}
    })()},180);
    return()=>{active=false;clearTimeout(start);if(analysisTimeout.current)clearTimeout(analysisTimeout.current);setCamera(false)};
  },[]));

  useEffect(()=>{
    const app=AppState.addEventListener('change',next=>{if(next==='background')pause()});
    const timer=setInterval(()=>{if(stateRef.current==='active')setSeconds(Math.floor((elapsed.current+Date.now()-startAt.current)/1000));if(Date.now()-lastFrame.current>1500){setVisible(false);engine.current.update(null,Date.now())}},200);
    return()=>{app.remove();clearInterval(timer)};
  },[pause]);

  const finishAnalysis=useCallback(async(event:CameraEvent)=>{
    if(analysisStarted.current||stateRef.current!=='analyzing')return;
    analysisStarted.current=true;
    if(analysisTimeout.current)clearTimeout(analysisTimeout.current);
    setCamera(false);
    const frames=event.frames??[],trace=event.trace??[];
    if(frames.length<3){setAnalysisError('Не хватило кадров для точной оценки. Результат тренировки всё равно сохранится.');change('result');return}
    try{
      const previous=await loadCoachMessages();
      const engineMetrics=summarizePoseTrace(trace);
      const result=await askCoach({
        nickname:profile.nickname,
        message:`Разбери технику в завершённой тренировке: ${count} отжиманий за ${finalSeconds.current} секунд.`,
        history:previous,
        frames,
        engineMetrics,
        mode:'direct',
        context:{sessionId,workout:{mode:kind,reps:count,seconds:finalSeconds.current,goal,programDay},program:program?{baseline:program.baseline,difficulty:program.difficulty}:null},
      });
      const technique:WorkoutTechniqueAssessment={
        score:result.score,verdict:result.verdict,summary:result.reply,view:result.view,
        strengths:result.strengths,
        errors:result.errors.map(item=>({code:item.code,observation:item.observation,correction:item.correction,severity:item.severity})),
        lessonIds:result.lessonIds,
        assessedAt:new Date().toISOString(),
      };
      setAssessment(technique);
      const coachEntry:CoachMessage={
        id:`workout-coach-${Date.now()}`,
        role:'assistant',
        content:result.reply,
        createdAt:technique.assessedAt,
        score:result.score,
        workout:{mode:kind,reps:count,seconds:finalSeconds.current,goal,programDay},
        focus:result.focus,
        errors:result.errors,
        strengths:result.strengths,
        nextStep:result.nextStep,
        followUp:result.followUp,
        nextShot:result.nextShot,
        lessonId:result.lessonId,
        lessonIds:result.lessonIds,
      };
      await saveCoachMessages([...previous,coachEntry]);
    }catch{
      setAnalysisError('Разбор сейчас недоступен. Результат тренировки можно сохранить.');
    }finally{change('result')}
  },[count,goal,kind,profile.nickname,program,programDay,sessionId]);

  const onEvent=useCallback((event:CameraEvent)=>{
    if(event.type==='complete'){void finishAnalysis(event);return}
    if(event.type==='error'){if(stateRef.current==='analyzing'){void finishAnalysis({type:'complete'});return}setError(event.message??'Камера недоступна');pause();return}
    if(event.type!=='pose')return;
    const now=Date.now(),o=event.observation??null;lastFrame.current=now;
    const valid=!!o&&o.confidence>=.55&&Number.isFinite(o.elbowAngle)&&Number.isFinite(o.armConfidence)&&o.armConfidence!>=.55;
    setVisible(valid);
    if(stateRef.current!=='finding'&&stateRef.current!=='active')return;
    const result=engine.current.update(valid?o:null,now);
    if(result.started){startAt.current=now;change('active');if(!captureStarted.current){captureStarted.current=true;cameraFeed.current?.startCapture()}}
    if(result.rep){const next=engine.current.counter!.count;setCount(next);playRepSound();void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});Animated.sequence([Animated.timing(pulse,{toValue:1.1,duration:80,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:160,useNativeDriver:true})]).start()}
  },[finishAnalysis,pause,playRepSound,pulse]);

  const finish=()=>{
    if(stateRef.current==='active')elapsed.current+=Date.now()-startAt.current;
    finalSeconds.current=Math.floor(elapsed.current/1000);setSeconds(finalSeconds.current);change('analyzing');
    cameraFeed.current?.completeCapture();
    analysisTimeout.current=setTimeout(()=>void finishAnalysis({type:'complete'}),8000);
  };
  const resume=()=>{engine.current.counter?.resetTracking();startAt.current=Date.now();cameraFeed.current?.startCapture();change('active')};
  const save=async()=>{if(saving)return;setSaving(true);try{await recordSession({id:sessionId,date:new Date().toISOString(),reps:count,seconds,goal,mode:kind,programDay,technique:assessment??undefined,synced:false});router.replace('/(tabs)/home')}catch{setError('Не удалось сохранить. Попробуй ещё раз.')}finally{setSaving(false)}};

  if(state==='result')return <ScrollView style={s.result} contentContainerStyle={[s.resultContent,{paddingTop:insets.top+22,paddingBottom:insets.bottom+24}]} showsVerticalScrollIndicator={false}><StatusBar style="dark"/>
    <Text style={s.logo}>Rep</Text>
    <View style={s.resultHero}><Text style={s.resultKicker}>{goal>0&&count>=goal?'Цель выполнена':kind==='free'?'Подход завершён':`Осталось ${Math.max(0,goal-count)}`}</Text><Text style={s.resultNumber}>{count}</Text><Text style={s.resultUnit}>отжиманий · {clock(seconds)}</Text></View>
    {assessment?<View style={s.techniqueCard}><View style={s.techniqueTop}><View><Text style={s.techniqueLabel}>Техника</Text><Text style={s.techniqueStatus}>{assessment.verdict==='good'?'Всё уверенно':'Есть что улучшить'}</Text></View>{assessment.score!==null?<View style={s.score}><Text style={s.scoreValue}>{String(assessment.score).replace('.',',')}</Text><Text style={s.scoreMax}>/ 10</Text></View>:null}</View><Text style={s.summary}>{assessment.summary}</Text>{assessment.lessonIds.filter(isCoachLessonId).map(lessonId=><TechniqueLessonCard key={lessonId} lessonId={lessonId}/>)}</View>:<View style={s.analysisNotice}><Ionicons color={colors.secondary} name="cloud-offline-outline" size={20}/><Text style={s.analysisNoticeText}>{analysisError||'Технику не удалось оценить в этом подходе.'}</Text></View>}
    <View style={s.resultActions}><PrimaryButton title={saving?'Сохраняем…':'Сохранить тренировку'} disabled={saving} onPress={()=>void save()}/><PrimaryButton title="Без сохранения" tone="plain" disabled={saving} onPress={()=>router.replace('/(tabs)/home')}/>{error?<Text style={s.error}>{error}</Text>:null}</View>
  </ScrollView>;

  const progress=goal?Math.min(1,count/goal):0;
  return <View style={s.camera}><StatusBar hidden/>{camera?<Awake/>:null}<View style={StyleSheet.absoluteFill}>{camera?<CameraFeed ref={cameraFeed} key={cameraKey} onEvent={onEvent}/>:null}</View><LinearGradient pointerEvents="none" colors={['rgba(0,0,0,.72)','transparent']} style={s.shade}/><View style={[s.top,{top:insets.top+12}]}><View style={s.live}><View style={[s.dot,visible&&s.dotOn]}/><Text style={s.liveText}>{kind==='program'||kind==='light'?`${count} / ${goal}`:'СВОБОДНЫЙ'}</Text></View><Animated.Text style={[s.count,{transform:[{scale:pulse}]}]}>{String(count).padStart(2,'0')}</Animated.Text><Text style={s.time}>{clock(seconds)}</Text>{goal>0?<View style={s.progress}><View style={[s.progressFill,{width:`${progress*100}%`}]}/></View>:null}</View>{state==='analyzing'?<View style={s.analyzing}><ActivityIndicator color="#fff" size="large"/><Text style={s.analyzingTitle}>Разбираем технику</Text></View>:<View style={[s.controls,{bottom:Math.max(insets.bottom,16)}]}>{error?<Text style={s.cameraError}>{error}</Text>:null}<View style={s.row}>{state==='paused'?<><Control title="Продолжить" primary onPress={resume}/><Control title="Завершить" onPress={finish}/></>:state==='active'?<><Control title="Пауза" onPress={pause}/><Control title="Завершить" primary onPress={finish}/></>:error?<><Control title="Повторить" primary onPress={restartCamera}/><Control title="Отмена" onPress={()=>{setCamera(false);router.back()}}/></>:<Control title="Отмена" onPress={()=>{setCamera(false);router.back()}}/>}</View></View>}</View>;
}
function Control({title,onPress,primary=false}:{title:string;onPress:()=>void;primary?:boolean}){return <Pressable onPress={onPress} style={[s.control,primary&&s.controlPrimary]}><Text style={[s.controlText,primary&&s.controlPrimaryText]}>{title}</Text></Pressable>}
const s=StyleSheet.create({
  camera:{flex:1,backgroundColor:'#060806'},shade:{position:'absolute',left:0,right:0,top:0,height:260},top:{position:'absolute',left:22,right:22,alignItems:'flex-start'},live:{height:34,borderRadius:17,backgroundColor:'rgba(0,0,0,.52)',paddingHorizontal:13,flexDirection:'row',alignItems:'center'},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#777',marginRight:8},dotOn:{backgroundColor:colors.green},liveText:{color:'#fff',fontSize:12,fontWeight:'700'},count:{fontSize:80,lineHeight:88,fontWeight:'800',color:'#fff',letterSpacing:-4,marginTop:3},time:{fontSize:15,color:'#fff'},progress:{width:180,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,.3)',marginTop:10,overflow:'hidden'},progressFill:{height:4,backgroundColor:'#fff'},controls:{position:'absolute',left:20,right:20},row:{flexDirection:'row',gap:10},control:{flex:1,height:58,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,.55)',backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',justifyContent:'center'},controlPrimary:{backgroundColor:'#fff',borderColor:'#fff'},controlText:{fontSize:17,fontWeight:'700',color:'#fff'},controlPrimaryText:{color:'#000'},cameraError:{color:'#fff',textAlign:'center',marginBottom:10},analyzing:{position:'absolute',inset:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(5,7,6,.72)'},analyzingTitle:{color:'#fff',fontSize:18,fontWeight:'700',marginTop:14},
  result:{flex:1,backgroundColor:colors.bg},resultContent:{paddingHorizontal:18},logo:{fontSize:22,fontWeight:'800'},resultHero:{alignItems:'center',paddingVertical:28},resultKicker:{fontSize:15,color:colors.secondary,fontWeight:'700'},resultNumber:{fontSize:104,lineHeight:116,fontWeight:'800',letterSpacing:-6},resultUnit:{fontSize:16,color:colors.secondary},techniqueCard:{backgroundColor:colors.card,borderRadius:24,padding:18,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line},techniqueTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},techniqueLabel:{fontSize:13,fontWeight:'700',color:colors.secondary},techniqueStatus:{fontSize:20,fontWeight:'800',marginTop:3},score:{flexDirection:'row',alignItems:'baseline'},scoreValue:{fontSize:42,lineHeight:46,fontWeight:'800',color:colors.blue,letterSpacing:-2},scoreMax:{fontSize:14,fontWeight:'700',color:colors.secondary,marginLeft:4},summary:{fontSize:15,lineHeight:22,color:colors.text,marginTop:16},analysisNotice:{borderRadius:20,backgroundColor:colors.card,padding:16,flexDirection:'row',alignItems:'center',gap:10},analysisNoticeText:{flex:1,fontSize:14,lineHeight:20,color:colors.secondary},resultActions:{gap:10,marginTop:18},error:{textAlign:'center',color:colors.red,fontSize:13},
});
