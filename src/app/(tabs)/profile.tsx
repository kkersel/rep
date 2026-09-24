import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../state/AppContext';
import { programSummary } from '../../program';
import { sessionStats } from '../../statistics';
import { Card, colors, ListRow, Loading, ProgressBar, Screen, SectionLabel } from '../../ui';

export default function ProfileScreen() {
  const { program, history, profile, gamification } = useApp();
  if (!program) return <Loading/>;
  const summary=programSummary(program), stats=sessionStats(history), initial=(profile.nickname||'Я').slice(0,2).toUpperCase();
  const recentMain=program.days.filter(day=>day.kind==='main'&&day.date<=new Date().toISOString().slice(0,10)).slice(-7);
  return <Screen>
    <View style={s.identity}><View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View><View style={s.identityText}><Text style={s.name}>{profile.nickname||'Твой профиль'}</Text><Text style={s.level}>Уровень {gamification.level} · {gamification.points} очков</Text></View></View>
    <Card style={s.levelCard}><View style={s.levelTop}><Text style={s.levelTitle}>До уровня {gamification.level+1}</Text><Text style={s.levelCount}>{gamification.current} / {gamification.needed}</Text></View><ProgressBar value={gamification.progress}/></Card>

    <SectionLabel>Серия</SectionLabel>
    <Card><View style={s.streakTop}><View><Text style={s.streakValue}>{program.workoutStreak}</Text><Text style={s.streakLabel}>основных подряд</Text></View><Text style={s.adherence}>{summary.adherence}% программы</Text></View><View style={s.weekDots}>{recentMain.map(day=><View key={day.index} style={s.day}><View style={[s.dayDot,day.status==='completed'&&s.dayDone,day.status==='failed'&&s.dayFailed]}/><Text style={s.dayText}>{day.index}</Text></View>)}</View></Card>

    <SectionLabel>Статистика</SectionLabel>
    <View style={s.grid}><Stat value={String(stats.reps)} label="Повторений"/><Stat value={String(stats.sessions)} label="Подходов"/><Stat value={String(stats.best)} label="Лучший подход"/><Stat value={`${Math.floor(stats.seconds/60)}м`} label="В тренировках"/></View>

    <SectionLabel>PvP</SectionLabel>
    <Card style={s.pvp}><Result value={String(stats.wins)} label="Победы"/><Result value={String(stats.losses)} label="Поражения"/><Result value={String(stats.draws)} label="Ничьи"/><Result value={String(stats.best60)} label="Рекорд"/></Card>

    {profile.friendCode?<Pressable onPress={()=>void Share.share({message:`Мой код друга в Rep: ${profile.friendCode}`})}><Card style={s.code}><View><Text style={s.codeLabel}>Код друга</Text><Text style={s.codeValue}>{profile.friendCode}</Text></View><Text style={s.share}>Поделиться</Text></Card></Pressable>:null}
    <Card style={s.links}><ListRow title="Подробная статистика" onPress={()=>router.push('/statistics')}/><ListRow title="Достижения" detail={`${gamification.achievements.filter(item=>item.unlockedAt).length} открыто`} onPress={()=>router.push('/achievements')}/><ListRow title="История тренировок" onPress={()=>router.push('/history')}/><ListRow title="Настройки" onPress={()=>router.push('/settings')}/></Card>
  </Screen>;
}
function Stat({value,label}:{value:string;label:string}){return <Card style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></Card>}
function Result({value,label}:{value:string;label:string}){return <View style={s.pvpItem}><Text style={s.pvpValue}>{value}</Text><Text style={s.pvpLabel}>{label}</Text></View>}
const s=StyleSheet.create({
  identity:{flexDirection:'row',alignItems:'center',paddingVertical:8},avatar:{width:70,height:70,borderRadius:24,backgroundColor:colors.text,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontSize:22,fontWeight:'800'},identityText:{marginLeft:16},name:{fontSize:25,fontWeight:'800',letterSpacing:-.5},level:{fontSize:14,color:colors.secondary,marginTop:4},levelCard:{marginTop:14},levelTop:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},levelTitle:{fontSize:14,fontWeight:'600'},levelCount:{fontSize:13,color:colors.secondary},
  streakTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},streakValue:{fontSize:58,lineHeight:62,fontWeight:'800',letterSpacing:-3},streakLabel:{fontSize:13,color:colors.secondary},adherence:{fontSize:13,color:colors.blue,fontWeight:'700'},weekDots:{flexDirection:'row',justifyContent:'space-between',marginTop:24},day:{alignItems:'center'},dayDot:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:colors.line},dayDone:{backgroundColor:colors.green,borderColor:colors.green},dayFailed:{borderColor:colors.red},dayText:{fontSize:10,color:colors.secondary,marginTop:5},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{width:'48.5%',height:112,justifyContent:'space-between'},statValue:{fontSize:34,fontWeight:'800'},statLabel:{fontSize:12,color:colors.secondary},pvp:{flexDirection:'row',paddingHorizontal:8},pvpItem:{flex:1,alignItems:'center'},pvpValue:{fontSize:25,fontWeight:'800'},pvpLabel:{fontSize:10,color:colors.secondary,marginTop:4},code:{marginTop:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},codeLabel:{fontSize:12,color:colors.secondary},codeValue:{fontSize:22,fontWeight:'800',letterSpacing:3,marginTop:3},share:{fontSize:14,color:colors.blue,fontWeight:'600'},links:{marginTop:18,paddingVertical:0}
});
