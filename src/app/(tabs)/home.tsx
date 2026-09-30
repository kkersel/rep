import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../../state/AppContext';
import { nextProgramTraining, programDayNumber, todayProgramDay } from '../../program';
import { Card, colors, Loading, Screen, SectionLabel } from '../../ui';

const formatDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const techniqueVideo = require('../../../assets/pushup-technique-gym-seamless-60fps.mp4');

function TechniqueCard() {
  const player = useVideoPlayer(techniqueVideo, value => {
    value.loop = true;
    value.muted = true;
  });
  useFocusEffect(useCallback(() => {
    player.play();
    return () => player.pause();
  }, [player]));

  return <Card style={s.technique}>
    <VideoView
      accessibilityLabel="Анимация правильной техники отжимания"
      allowsPictureInPicture={false}
      contentFit="contain"
      nativeControls={false}
      player={player}
      playsInline
      style={s.techniqueVideo}
    />
  </Card>;
}

export default function HomeScreen() {
  const { loaded, program } = useApp();

  if (!loaded || !program) return <Loading/>;
  const today=todayProgramDay(program),next=nextProgramTraining(program),day=programDayNumber(program);
  const trainable=today&&(today.kind==='main'||today.kind==='light')&&today.status==='upcoming';

  const startToday=()=>trainable
    ?router.push({pathname:'/session',params:{kind:today.kind==='main'?'program':'light',goal:today.target,day:today.index}})
    :router.push('/program');
  const todayTitle=today?.status==='completed'?'Выполнено':trainable?(today.kind==='main'?'Основная':'Лёгкая'):'Восстановление';
  const todayDetail=trainable?`${today.target} повторов`:next?`Следующая ${formatDate(next.date)}`:'Цикл завершён';

  return <View style={s.root}>
    <Screen style={s.content}>
      <Pressable onPress={() => router.push('/coach')} style={({pressed})=>pressed&&s.pressed}><Card style={s.coachHero}>
        <View style={s.coachIcon}><Ionicons color="#fff" name="sparkles" size={24}/></View>
        <Text style={s.coachEyebrow}>AI-ТРЕНЕР</Text>
        <Text style={s.coachTitle}>Разбери свою технику</Text>
        <Text style={s.coachDetail}>Сними короткий подход. Тренер найдёт главную ошибку и подскажет, что исправить.</Text>
        <View style={s.coachAction}><Text style={s.coachActionText}>Открыть тренера</Text><Ionicons color="#fff" name="arrow-forward" size={18}/></View>
      </Card></Pressable>

      <SectionLabel>Тренировки</SectionLabel>
      <Card style={s.trainingList}>
        <Pressable onPress={startToday} style={({pressed})=>[s.training,pressed&&s.pressed]}><View style={s.trainingIcon}><Ionicons color={colors.blue} name="calendar" size={20}/></View><View style={s.trainingInfo}><Text style={s.trainingTitle}>{todayTitle}</Text><Text style={s.trainingDetail}>День {day} · {todayDetail}</Text></View><Ionicons color={colors.tertiary} name="chevron-forward" size={20}/></Pressable>
        <Pressable onPress={()=>router.push({pathname:'/session',params:{kind:'free',goal:0}})} style={({pressed})=>[s.training,s.line,pressed&&s.pressed]}><View style={s.trainingIcon}><Ionicons color={colors.blue} name="infinite" size={22}/></View><View style={s.trainingInfo}><Text style={s.trainingTitle}>Свободная</Text><Text style={s.trainingDetail}>Без цели и таймера</Text></View><Ionicons color={colors.tertiary} name="chevron-forward" size={20}/></Pressable>
        <Pressable onPress={()=>router.push('/pvp')} style={({pressed})=>[s.training,s.line,pressed&&s.pressed]}><View style={s.trainingIcon}><Ionicons color={colors.blue} name="trophy" size={20}/></View><View style={s.trainingInfo}><Text style={s.trainingTitle}>PvP</Text><Text style={s.trainingDetail}>Создать игру или найти соперника</Text></View><Ionicons color={colors.tertiary} name="chevron-forward" size={20}/></Pressable>
      </Card>

      <SectionLabel>Техника</SectionLabel>
      <TechniqueCard/>
    </Screen>

    <Pressable accessibilityRole="button" accessibilityLabel="Открыть AI-тренера" onPress={()=>router.push('/coach')} style={({pressed})=>[s.coachButton,pressed&&s.coachButtonPressed]}>
      <Ionicons color="#fff" name="sparkles" size={21}/><Text style={s.coachButtonText}>AI-тренер</Text>
    </Pressable>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},content:{paddingBottom:210},pressed:{opacity:.62},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},
  coachHero:{minHeight:258,padding:22,backgroundColor:'#111318',borderColor:'#111318'},coachIcon:{width:46,height:46,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.blue},coachEyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.3,color:'#8EBEFF',marginTop:19},coachTitle:{fontSize:29,lineHeight:33,fontWeight:'800',letterSpacing:-.8,color:'#fff',marginTop:7},coachDetail:{fontSize:14,lineHeight:20,color:'#A7A7AC',marginTop:9,maxWidth:310},coachAction:{height:42,alignSelf:'flex-start',borderRadius:15,paddingHorizontal:14,marginTop:18,backgroundColor:colors.blue,flexDirection:'row',alignItems:'center',gap:8},coachActionText:{color:'#fff',fontSize:13,fontWeight:'800'},
  trainingList:{paddingVertical:2},training:{minHeight:68,flexDirection:'row',alignItems:'center'},trainingIcon:{width:40,height:40,borderRadius:13,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},trainingInfo:{flex:1,marginLeft:12},trainingTitle:{fontSize:15,fontWeight:'700'},trainingDetail:{fontSize:11,color:colors.secondary,marginTop:3},
  technique:{padding:0,overflow:'hidden',aspectRatio:16/9},techniqueVideo:{width:'100%',height:'100%',backgroundColor:'#fff'},
  coachButton:{position:'absolute',left:'50%',bottom:18,width:164,height:58,marginLeft:-82,borderRadius:29,backgroundColor:colors.blue,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,shadowColor:'#006FE6',shadowOpacity:.3,shadowRadius:15,shadowOffset:{width:0,height:8},elevation:9},coachButtonPressed:{opacity:.82,transform:[{scale:.97}]},coachButtonText:{color:'#fff',fontSize:16,fontWeight:'800'},
});
