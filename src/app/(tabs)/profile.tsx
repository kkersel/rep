import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../state/AppContext';
import { programSummary } from '../../program';
import { Card, colors, Loading, Screen, SectionLabel } from '../../ui';

export default function ProfileScreen() {
  const { program, history } = useApp();
  if (!program) return <Loading/>;
  const summary = programSummary(program);
  const total = history.reduce((sum,item)=>sum+item.reps,0);
  const seconds = history.reduce((sum,item)=>sum+item.seconds,0);
  const best = history.reduce((value,item)=>Math.max(value,item.reps),0);
  const wins = history.filter(item=>item.pvpResult==='win').length;
  const losses = history.filter(item=>item.pvpResult==='loss').length;
  return <Screen>
    <Card style={s.streak}><Text style={s.streakLabel}>Серия тренировок</Text><View style={s.streakRow}><Text style={s.streakNumber}>{program.workoutStreak}</Text><Text style={s.streakUnit}>подряд</Text></View><View style={s.bar}><View style={[s.barFill,{width:`${summary.adherence}%`}]}/></View><Text style={s.adherence}>{summary.adherence}% программы выполнено</Text></Card>
    <SectionLabel>Статистика</SectionLabel><View style={s.grid}>
      <Stat value={String(total)} label="Повторений"/><Stat value={String(history.length)} label="Подходов"/><Stat value={String(best)} label="Лучший подход"/><Stat value={`${Math.floor(seconds/60)}м`} label="В тренировках"/><Stat value={String(wins)} label="Победы PvP"/><Stat value={String(losses)} label="Поражения PvP"/>
    </View>
    <Pressable onPress={()=>router.push('/history')}><Card style={s.link}><Text style={s.linkText}>История тренировок</Text><Text style={s.chev}>›</Text></Card></Pressable>
  </Screen>;
}
function Stat({value,label}:{value:string;label:string}){return <Card style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></Card>}
const s=StyleSheet.create({streak:{minHeight:270,justifyContent:'space-between'},streakLabel:{fontSize:15,fontWeight:'700',color:colors.secondary},streakRow:{flexDirection:'row',alignItems:'baseline'},streakNumber:{fontSize:112,lineHeight:120,fontWeight:'800',letterSpacing:-7},streakUnit:{fontSize:18,fontWeight:'600',color:colors.secondary,marginLeft:16},bar:{height:8,borderRadius:4,backgroundColor:'#E5E5EA',overflow:'hidden'},barFill:{height:8,backgroundColor:colors.blue,borderRadius:4},adherence:{fontSize:13,color:colors.secondary},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{width:'48.5%',height:124,justifyContent:'space-between'},statValue:{fontSize:36,fontWeight:'700'},statLabel:{fontSize:13,color:colors.secondary,fontWeight:'600'},link:{marginTop:26,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},linkText:{fontSize:17,fontWeight:'600',color:colors.blue},chev:{fontSize:28,color:colors.tertiary}});
