import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/AppContext';
import { localDateKey, programSummary } from '../program';
import { Card, colors, Loading, PrimaryButton, Screen, SectionLabel } from '../ui';

export default function ProgramScreen() {
  const { program, restartProgram } = useApp(); const [restarting,setRestarting]=useState(false);
  if (!program) return <Loading/>;
  const today=localDateKey(), summary=programSummary(program), todayDay=program.days.find(d=>d.date===today);
  return <Screen><Card style={s.summary}><Text style={s.day}>День {Math.min(30,Math.max(1,Math.floor((new Date(`${today}T12:00:00`).getTime()-new Date(`${program.startDate}T12:00:00`).getTime())/86400000)+1))} из 30</Text><Text style={s.big}>{summary.completed} / {summary.total}</Text><Text style={s.muted}>тренировок выполнено</Text></Card>
    <SectionLabel>Календарь</SectionLabel><Card style={s.calendar}>{program.days.map(day=><View key={day.index} style={s.cell}><View style={[s.dot,day.kind==='recovery'&&s.rest,day.kind==='summary'&&s.summaryDot,day.status==='completed'&&s.done,day.status==='failed'&&s.failed,day.status==='skipped'&&s.skipped,day.date===today&&s.today]}><Text style={[s.dotText,(day.status==='completed'||day.date===today)&&s.dotTextOn]}>{day.status==='completed'?'✓':day.index}</Text></View><Text style={s.target}>{day.kind==='training'?day.target:day.kind==='summary'?'итог':'·'}</Text></View>)}</Card>
    {program.status==='completed'?<><SectionLabel>Результат цикла</SectionLabel><Card style={s.resultGrid}><Result value={String(summary.baseline)} label="Старт"/><Result value={summary.control===null?'—':String(summary.control)} label="Контроль"/><Result value={String(summary.best)} label="Лучший"/><Result value={`${summary.adherence}%`} label="Выполнено"/></Card></>:null}
    {todayDay?.kind==='training'&&todayDay.status==='upcoming'?<PrimaryButton title={`Начать · ${todayDay.target}`} onPress={()=>router.push({pathname:'/session',params:{kind:'program',goal:todayDay.target,day:todayDay.index}})}/>:null}
    {program.status==='completed'?<View style={{marginTop:18}}><PrimaryButton title={restarting?'Создаём…':'Новый цикл'} disabled={restarting} onPress={()=>{setRestarting(true);void restartProgram(summary.control??summary.best).then(()=>setRestarting(false));}}/></View>:null}
  </Screen>;
}
function Result({value,label}:{value:string;label:string}){return <View style={s.result}><Text style={s.resultValue}>{value}</Text><Text style={s.resultLabel}>{label}</Text></View>}
const s=StyleSheet.create({summary:{minHeight:176,justifyContent:'center'},day:{fontSize:15,color:colors.secondary,fontWeight:'700'},big:{fontSize:58,lineHeight:66,fontWeight:'800',letterSpacing:-3,marginTop:8},muted:{fontSize:14,color:colors.secondary},calendar:{flexDirection:'row',flexWrap:'wrap',padding:12},cell:{width:'16.66%',alignItems:'center',marginVertical:7},dot:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},rest:{borderStyle:'dashed'},summaryDot:{backgroundColor:colors.text},done:{backgroundColor:colors.green,borderColor:colors.green},failed:{borderColor:colors.red},skipped:{backgroundColor:'#E5E5EA'},today:{backgroundColor:colors.blue,borderColor:colors.blue},dotText:{fontSize:12,fontWeight:'700',color:colors.secondary},dotTextOn:{color:'#fff'},target:{fontSize:10,color:colors.secondary,marginTop:3},resultGrid:{flexDirection:'row',paddingVertical:20},result:{flex:1,alignItems:'center'},resultValue:{fontSize:27,fontWeight:'800'},resultLabel:{fontSize:11,color:colors.secondary,marginTop:4}});
