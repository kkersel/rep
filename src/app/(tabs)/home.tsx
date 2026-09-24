import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../state/AppContext';
import { nextProgramTraining, programSummary, todayProgramDay } from '../../program';
import { Card, colors, Loading, Screen, SectionLabel } from '../../ui';

export default function HomeScreen() {
  const { loaded, program, history } = useApp();
  if (!loaded || !program) return <Loading/>;
  const today = todayProgramDay(program);
  const next = nextProgramTraining(program);
  const summary = programSummary(program);
  const canTrain = today?.kind === 'training' && today.status === 'upcoming';
  const completed = today?.kind === 'training' && today.status === 'completed';
  const openDaily = () => canTrain ? router.push({ pathname: '/session', params: { kind: 'program', goal: today.target, day: today.index } }) : router.push('/program');
  const dateLabel = next ? new Date(`${next.date}T12:00:00`).toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) : '';
  return <Screen>
    <Pressable onPress={openDaily} style={({ pressed }) => pressed && { opacity:.75 }}>
      <Card style={s.hero}>
        <View><Text style={s.kicker}>{completed ? 'Тренировка выполнена' : canTrain ? `День ${today.index} · тренировка` : today?.kind === 'summary' ? 'Программа завершена' : 'Восстановление'}</Text>
          {canTrain ? <><Text style={s.goal}>{today.target}</Text><Text style={s.goalLabel}>отжиманий сегодня</Text></> : completed ? <><Text style={s.goal}>✓</Text><Text style={s.goalLabel}>Можно отдыхать</Text></> : <><Text style={s.rest}>Отдых</Text><Text style={s.goalLabel}>{next ? `Следующая цель ${next.target} · ${dateLabel}` : `Выполнено ${summary.completed} из ${summary.total}`}</Text></>}
        </View><View style={s.arrow}><Text style={s.arrowText}>→</Text></View>
      </Card>
    </Pressable>
    <SectionLabel>Режимы</SectionLabel>
    <View style={s.modeRow}>
      <Pressable style={s.modePress} onPress={() => router.push({ pathname:'/session', params:{ kind:'free', goal:0 } })}><Card style={s.mode}><Text style={s.modeIcon}>∞</Text><Text style={s.modeTitle}>Свободный</Text><Text style={s.modeCopy}>Без цели</Text></Card></Pressable>
      <Pressable style={s.modePress} onPress={() => router.push('/pvp')}><Card style={[s.mode,{backgroundColor:colors.text}]}><Text style={[s.modeIcon,{color:'#fff'}]}>↗</Text><Text style={[s.modeTitle,{color:'#fff'}]}>PvP</Text><Text style={[s.modeCopy,{color:'#AEAEB2'}]}>60 секунд</Text></Card></Pressable>
    </View>
    <SectionLabel>Программа</SectionLabel>
    <Pressable onPress={() => router.push('/program')}><Card style={s.progressCard}><View><Text style={s.progressValue}>{summary.completed} / {summary.total}</Text><Text style={s.progressLabel}>тренировок завершено</Text></View><Text style={s.link}>Все 30 дней ›</Text></Card></Pressable>
    <SectionLabel>Последние подходы</SectionLabel>
    <Card style={s.activity}>{history.length === 0 ? <Text style={s.empty}>Первая тренировка появится здесь.</Text> : history.slice(0,3).map((item,i)=><View key={item.id} style={[s.activityRow,i>0&&s.separator]}><View><Text style={s.activityTitle}>{item.mode === 'pvp' ? 'PvP' : item.mode === 'program' ? 'Программа' : 'Свободный'}</Text><Text style={s.activityDate}>{new Date(item.date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</Text></View><Text style={s.activityReps}>{item.reps}</Text></View>)}</Card>
  </Screen>;
}
const s=StyleSheet.create({hero:{minHeight:260,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',padding:24},kicker:{fontSize:15,fontWeight:'700',color:colors.secondary},goal:{fontSize:100,lineHeight:112,fontWeight:'800',letterSpacing:-6,marginTop:12},rest:{fontSize:52,lineHeight:62,fontWeight:'800',letterSpacing:-2,marginTop:34},goalLabel:{fontSize:15,color:colors.secondary,fontWeight:'600'},arrow:{width:54,height:54,borderRadius:27,backgroundColor:colors.blue,alignItems:'center',justifyContent:'center'},arrowText:{fontSize:28,color:'#fff'},modeRow:{flexDirection:'row',gap:10},modePress:{flex:1},mode:{height:150,justifyContent:'flex-end'},modeIcon:{fontSize:32,fontWeight:'700',color:colors.blue,marginBottom:18},modeTitle:{fontSize:20,fontWeight:'700'},modeCopy:{fontSize:13,color:colors.secondary,marginTop:4},progressCard:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},progressValue:{fontSize:28,fontWeight:'700'},progressLabel:{fontSize:13,color:colors.secondary,marginTop:3},link:{color:colors.blue,fontWeight:'600'},activity:{paddingVertical:4},activityRow:{minHeight:70,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},separator:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},activityTitle:{fontSize:16,fontWeight:'600'},activityDate:{fontSize:13,color:colors.secondary,marginTop:3},activityReps:{fontSize:28,fontWeight:'700'},empty:{color:colors.secondary,paddingVertical:24,textAlign:'center'}});
