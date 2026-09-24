import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../state/AppContext';
import { dailyReps, filteredHistory, sessionStats, type StatsPeriod } from '../statistics';
import { Card, colors, Screen, SectionLabel, Segmented } from '../ui';

export default function StatisticsScreen(){
  const{history}=useApp();const[period,setPeriod]=useState<StatsPeriod>('7d');
  useEffect(()=>{void AsyncStorage.getItem('rep.stats.period').then(value=>{if(value==='7d'||value==='30d'||value==='all')setPeriod(value)})},[]);
  const selectPeriod=(value:StatsPeriod)=>{setPeriod(value);void AsyncStorage.setItem('rep.stats.period',value)};
  const filtered=filteredHistory(history,period),stats=sessionStats(filtered),bars=dailyReps(filtered,period==='7d'?7:30);
  const compact=period==='30d'?bars.filter((_,i)=>i%4===0||i===29):bars,max=Math.max(1,...compact.map(item=>item.reps));
  return <Screen>
    <Segmented value={period} onChange={selectPeriod} options={[{value:'7d',label:'7 дней'},{value:'30d',label:'30 дней'},{value:'all',label:'Всё время'}]}/>
    {history.length===0?<Card style={s.empty}><Text style={s.emptyTitle}>Пока нет данных</Text><Text style={s.emptyCopy}>Первая сохранённая тренировка появится в статистике.</Text></Card>:<>
      <Card style={s.chart}><Text style={s.chartTotal}>{stats.reps}</Text><Text style={s.chartLabel}>повторений за период</Text><View style={s.bars}>{compact.map(item=>{const height=Math.max(4,78*item.reps/max),mainHeight=item.reps?height*item.main/item.reps:0,lightHeight=item.reps?height*item.light/item.reps:0;return <View key={item.date} style={s.barColumn}><View style={[s.barTrack,{height}]}><View style={[s.barOther,{flex:Math.max(0,item.reps-item.main-item.light)}]}/><View style={[s.barLight,{height:lightHeight}]}/><View style={[s.barMain,{height:mainHeight}]}/></View><Text style={s.barLabel}>{item.label}</Text></View>})}</View></Card>
      <SectionLabel>Тренировки</SectionLabel><View style={s.grid}><Metric value={stats.sessions} label="Подходов"/><Metric value={stats.best} label="Лучший"/><Metric value={stats.main} label="Основных"/><Metric value={stats.light} label="Лёгких"/><Metric value={stats.free} label="Свободных"/><Metric value={Math.floor(stats.seconds/60)} label="Минут"/></View>
      <SectionLabel>PvP</SectionLabel><Card style={s.pvp}><MetricPlain value={stats.wins} label="Победы"/><MetricPlain value={stats.losses} label="Поражения"/><MetricPlain value={stats.draws} label="Ничьи"/><MetricPlain value={stats.best60} label="Рекорд"/></Card>
    </>}
  </Screen>
}
function Metric({value,label}:{value:number;label:string}){return <Card style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></Card>}
function MetricPlain({value,label}:{value:number;label:string}){return <View style={s.plain}><Text style={s.plainValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
const s=StyleSheet.create({empty:{alignItems:'center',paddingVertical:64},emptyTitle:{fontSize:21,fontWeight:'700'},emptyCopy:{fontSize:14,color:colors.secondary,textAlign:'center',marginTop:7},chart:{height:210},chartTotal:{fontSize:38,fontWeight:'800'},chartLabel:{fontSize:12,color:colors.secondary},bars:{flex:1,flexDirection:'row',alignItems:'flex-end',gap:5,marginTop:16},barColumn:{flex:1,alignItems:'center',justifyContent:'flex-end'},barTrack:{width:'70%',borderRadius:5,overflow:'hidden',backgroundColor:colors.blue},barOther:{backgroundColor:colors.blue,minHeight:0},barLight:{backgroundColor:colors.green},barMain:{backgroundColor:colors.text},barLabel:{fontSize:9,color:colors.secondary,marginTop:5},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},metric:{width:'31%',height:94,justifyContent:'space-between'},metricValue:{fontSize:28,fontWeight:'800'},metricLabel:{fontSize:11,color:colors.secondary},pvp:{flexDirection:'row',paddingHorizontal:6},plain:{flex:1,alignItems:'center'},plainValue:{fontSize:25,fontWeight:'800',marginBottom:4}});
