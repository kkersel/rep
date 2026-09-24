import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../state/AppContext';
import { nextProgramTraining, programDayNumber, programSummary, todayProgramDay } from '../../program';
import { Card, colors, Loading, ProgressBar, Screen, SectionLabel } from '../../ui';

const formatDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export default function HomeScreen() {
  const { loaded, program, history, leaders, gamification } = useApp();
  if (!loaded || !program) return <Loading/>;
  const today = todayProgramDay(program), next = nextProgramTraining(program), summary = programSummary(program);
  const trainable = today && (today.kind === 'main' || today.kind === 'light') && today.status === 'upcoming';
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weekMain = history.filter(item => item.mode === 'program' && +new Date(item.date) >= weekStart.getTime() && item.reps >= item.goal).length;
  const day = programDayNumber(program);
  const startToday = () => trainable
    ? router.push({ pathname: '/session', params: { kind: today.kind === 'main' ? 'program' : 'light', goal: today.target, day: today.index } })
    : router.push('/program');
  const title = today?.status === 'completed' ? 'Готово на сегодня' : trainable ? (today.kind === 'main' ? 'Основная тренировка' : 'Лёгкий день') : 'Восстановление';
  const detail = trainable ? `${today.target} отжиманий` : next ? `Следующая тренировка ${formatDate(next.date)}` : 'Цикл завершён';
  return <Screen>
    <Pressable onPress={startToday} style={({ pressed }) => pressed && s.pressed}>
      <Card style={s.today}>
        <View style={s.todayTop}><Text style={s.eyebrow}>День {day} из 30</Text><Text style={s.arrow}>→</Text></View>
        <Text style={s.todayTitle}>{title}</Text>
        <Text style={s.todayDetail}>{detail}</Text>
        <View style={s.week}><Text style={s.weekLabel}>Основные на этой неделе</Text><Text style={s.weekValue}>{Math.min(weekMain,3)} / 3</Text></View>
        <ProgressBar value={weekMain / 3}/>
      </Card>
    </Pressable>

    <SectionLabel>Тренировка</SectionLabel>
    <View style={s.modeRow}>
      <Pressable style={s.modePress} onPress={() => router.push({ pathname: '/session', params: { kind: 'free', goal: 0 } })}>
        <Card style={s.mode}><Text style={s.modeMark}>∞</Text><Text style={s.modeTitle}>Свободная</Text><Text style={s.modeDetail}>Без цели</Text></Card>
      </Pressable>
      <Pressable style={s.modePress} onPress={() => router.push('/pvp')}>
        <Card style={s.mode}><Text style={[s.modeMark,{color:colors.orange}]}>60</Text><Text style={s.modeTitle}>PvP</Text><Text style={s.modeDetail}>Один на один</Text></Card>
      </Pressable>
    </View>

    <SectionLabel>Прогресс</SectionLabel>
    <Pressable onPress={() => router.push('/program')}><Card style={s.program}>
      <View><Text style={s.programValue}>{summary.completed} из {summary.total}</Text><Text style={s.programLabel}>основных тренировок</Text></View>
      <View style={s.level}><Text style={s.levelText}>Ур. {gamification.level}</Text></View>
    </Card></Pressable>

    {leaders.filter(item=>item.userId!==undefined).length > 1 ? <><SectionLabel>Друзья</SectionLabel><Card style={s.activity}>{leaders.filter(item=>item.userId).slice(0,3).map((item,index)=><View key={item.userId} style={[s.friend,index>0&&s.line]}><View style={s.avatar}><Text style={s.avatarText}>{item.nickname.slice(0,2).toUpperCase()}</Text></View><Text style={s.friendName}>{item.nickname}</Text><Text style={s.friendValue}>{item.wins} побед</Text></View>)}</Card></> : null}
    {history.length === 0 ? <Text style={s.context}>Начни с сегодняшней цели. Программа сама подстроит следующую основную тренировку.</Text> : null}
  </Screen>;
}

const s=StyleSheet.create({
  pressed:{opacity:.72},today:{minHeight:238,padding:22},todayTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{fontSize:13,fontWeight:'700',color:colors.secondary},arrow:{fontSize:24,color:colors.blue},todayTitle:{fontSize:34,lineHeight:40,fontWeight:'800',letterSpacing:-1.2,marginTop:24},todayDetail:{fontSize:18,color:colors.secondary,marginTop:6},week:{flexDirection:'row',justifyContent:'space-between',marginTop:32,marginBottom:8},weekLabel:{fontSize:12,color:colors.secondary},weekValue:{fontSize:12,fontWeight:'700'},
  modeRow:{flexDirection:'row',gap:10},modePress:{flex:1},mode:{minHeight:148,justifyContent:'space-between'},modeMark:{fontSize:30,fontWeight:'800',color:colors.blue},modeTitle:{fontSize:18,fontWeight:'700'},modeDetail:{fontSize:13,color:colors.secondary},program:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},programValue:{fontSize:25,fontWeight:'800'},programLabel:{fontSize:13,color:colors.secondary,marginTop:3},level:{paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:colors.blueSoft},levelText:{color:colors.blue,fontWeight:'700'},
  activity:{paddingVertical:2},friend:{height:62,flexDirection:'row',alignItems:'center'},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},avatar:{width:38,height:38,borderRadius:13,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:12,fontWeight:'800',color:colors.blue},friendName:{flex:1,fontSize:15,fontWeight:'600',marginLeft:11},friendValue:{fontSize:13,color:colors.secondary},context:{fontSize:13,lineHeight:19,color:colors.secondary,textAlign:'center',marginHorizontal:28,marginTop:24}
});
