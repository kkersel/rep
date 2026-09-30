import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/AppContext';
import { localDateKey, PROGRAM_DIFFICULTIES, programDayNumber, programDifficultyInfo, programSummary, type ProgramDifficulty } from '../program';
import { Card, colors, Loading, PrimaryButton, ProgressBar, Screen, SectionLabel } from '../ui';

export default function ProgramScreen() {
  const { program, restartProgram, changeProgramDifficulty } = useApp();
  const [restarting,setRestarting]=useState(false);
  const [changing,setChanging]=useState<ProgramDifficulty|null>(null);
  if (!program) return <Loading/>;
  const today=localDateKey(), summary=programSummary(program), todayDay=program.days.find(d=>d.date===today), dayNumber=programDayNumber(program);
  const trainable = todayDay && (todayDay.kind==='main'||todayDay.kind==='light') && todayDay.status==='upcoming';
  const selectDifficulty=async(difficulty:ProgramDifficulty)=>{
    if(difficulty===program.difficulty||changing)return;
    setChanging(difficulty);
    try{await changeProgramDifficulty(difficulty);}finally{setChanging(null);}
  };
  return <Screen>
    <Card style={s.overview}>
      <View style={s.topline}><Text style={s.day}>День {dayNumber} из 30</Text><Text style={s.percent}>{summary.adherence}%</Text></View>
      <Text style={s.big}>{summary.completed} / {summary.total}</Text>
      <Text style={s.muted}>основных тренировок</Text>
      <View style={{marginTop:18}}><ProgressBar value={summary.completed/summary.total}/></View>
      <Text style={s.rhythm}>3 основные · 2 лёгкие · 2 восстановления</Text>
    </Card>

    {program.status==='active'?<><SectionLabel>Сложность</SectionLabel><Card style={s.difficultyCard}>
      <View style={s.difficultyOptions}>{PROGRAM_DIFFICULTIES.map(option=><Pressable accessibilityRole="button" disabled={!!changing} key={option.id} onPress={()=>void selectDifficulty(option.id)} style={({pressed})=>[s.difficultyOption,program.difficulty===option.id&&s.difficultyActive,pressed&&s.pressed]}><Text style={[s.difficultyLabel,program.difficulty===option.id&&s.difficultyLabelActive]}>{option.label}</Text></Pressable>)}</View>
      <Text style={s.difficultyDescription}>{changing?'Пересчитываем будущие цели…':programDifficultyInfo(program.difficulty).description}</Text>
    </Card></>:null}

    <View style={s.legend}><Legend color={colors.blue} text="Основная"/><Legend color={colors.green} text="Лёгкая"/><Legend color="#E5E5EA" text="Отдых"/></View>
    <Card style={s.calendar}>{program.days.map(day=>{
      const completed=day.status==='completed', failed=day.status==='failed'||day.status==='skipped', isToday=day.date===today;
      const backgroundColor=completed?colors.text:day.kind==='main'?colors.blueSoft:day.kind==='light'?'#EAF8EE':'#F2F2F7';
      return <Pressable key={day.index} disabled={!isToday||!trainable} onPress={()=>router.push({pathname:'/session',params:{kind:day.kind==='main'?'program':'light',goal:day.target,day:day.index}})} style={s.cell}>
        <View style={[s.dot,{backgroundColor},isToday&&s.today,failed&&s.failed]}><Text style={[s.dotText,completed&&s.doneText]}>{completed?'✓':day.index}</Text></View>
        <Text style={s.target}>{day.kind==='recovery'?'·':day.target}</Text>
      </Pressable>;
    })}</Card>

    {trainable ? <View style={s.action}><PrimaryButton title={todayDay.kind==='main'?`Начать · ${todayDay.target}`:`Лёгкий подход · ${todayDay.target}`} onPress={()=>router.push({pathname:'/session',params:{kind:todayDay.kind==='main'?'program':'light',goal:todayDay.target,day:todayDay.index}})}/></View> : null}
    {todayDay?.kind==='recovery' ? <Card style={s.recovery}><Text style={s.recoveryTitle}>Восстановление</Text><Text style={s.recoveryText}>Сегодня нагрузка не нужна. День отдыха сохраняет серию.</Text></Card> : null}

    {program.status==='completed'?<><SectionLabel>Итог цикла</SectionLabel><Card style={s.resultGrid}><Result value={String(summary.baseline)} label="Старт"/><Result value={summary.control===null?'—':String(summary.control)} label="Контроль"/><Result value={String(summary.best)} label="Лучший"/><Result value={`${summary.adherence}%`} label="Выполнено"/></Card><View style={s.action}><PrimaryButton title={restarting?'Создаём…':'Начать новый цикл'} disabled={restarting} onPress={()=>{setRestarting(true);void restartProgram(summary.control ?? (summary.best || summary.baseline),program.difficulty).finally(()=>setRestarting(false));}}/></View></>:null}
  </Screen>;
}
function Legend({color,text}:{color:string;text:string}){return <View style={s.legendItem}><View style={[s.legendDot,{backgroundColor:color}]}/><Text style={s.legendText}>{text}</Text></View>}
function Result({value,label}:{value:string;label:string}){return <View style={s.result}><Text style={s.resultValue}>{value}</Text><Text style={s.resultLabel}>{label}</Text></View>}
const s=StyleSheet.create({
  overview:{minHeight:210},topline:{flexDirection:'row',justifyContent:'space-between'},day:{fontSize:14,color:colors.secondary,fontWeight:'700'},percent:{fontSize:14,color:colors.blue,fontWeight:'700'},big:{fontSize:56,lineHeight:64,fontWeight:'800',letterSpacing:-3,marginTop:18},muted:{fontSize:14,color:colors.secondary},rhythm:{fontSize:12,color:colors.secondary,marginTop:12},
  difficultyCard:{padding:8},difficultyOptions:{flexDirection:'row',gap:4},difficultyOption:{flex:1,minHeight:42,borderRadius:14,alignItems:'center',justifyContent:'center'},difficultyActive:{backgroundColor:colors.blueSoft},difficultyLabel:{fontSize:12,fontWeight:'700',color:colors.secondary},difficultyLabelActive:{color:colors.blue},difficultyDescription:{fontSize:12,lineHeight:17,color:colors.secondary,paddingHorizontal:10,paddingTop:10,paddingBottom:5},pressed:{opacity:.6},
  legend:{flexDirection:'row',gap:14,marginVertical:18,paddingHorizontal:4},legendItem:{flexDirection:'row',alignItems:'center',gap:5},legendDot:{width:8,height:8,borderRadius:4},legendText:{fontSize:11,color:colors.secondary},calendar:{flexDirection:'row',flexWrap:'wrap',padding:12},cell:{width:'16.66%',alignItems:'center',marginVertical:7},dot:{width:38,height:38,borderRadius:13,borderWidth:1,borderColor:'transparent',alignItems:'center',justifyContent:'center'},today:{borderColor:colors.blue,borderWidth:2},failed:{opacity:.38},dotText:{fontSize:12,fontWeight:'700',color:colors.text},doneText:{color:'#fff'},target:{fontSize:10,color:colors.secondary,marginTop:3},action:{marginTop:16},recovery:{marginTop:16},recoveryTitle:{fontSize:18,fontWeight:'700'},recoveryText:{fontSize:14,lineHeight:20,color:colors.secondary,marginTop:5},
  resultGrid:{flexDirection:'row',paddingVertical:20},result:{flex:1,alignItems:'center'},resultValue:{fontSize:27,fontWeight:'800'},resultLabel:{fontSize:11,color:colors.secondary,marginTop:4}
});
