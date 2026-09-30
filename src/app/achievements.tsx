import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AchievementMedal } from '../AchievementMedal';
import { useApp } from '../state/AppContext';
import { Card, colors, ProgressBar, Screen } from '../ui';

export default function AchievementsScreen(){
  const{gamification}=useApp();
  return <Screen><Card style={s.list}>{gamification.achievements.map((item,index)=><View key={item.id} style={[s.row,index>0&&s.line]}>
    <AchievementMedal id={item.id} onTurnEnd={()=>router.push({pathname:'/achievement',params:{id:item.id}})} size={64} unlocked={Boolean(item.unlockedAt)}/>
    <View style={s.content}><View style={s.top}><Text style={s.title}>{item.title}</Text><Text style={s.count}>{Math.min(item.current,item.target)} / {item.target}</Text></View><Text style={s.detail}>{item.detail}</Text><View style={{marginTop:9}}><ProgressBar value={item.current/item.target} color={item.unlockedAt?colors.green:colors.blue}/></View>{item.unlockedAt?<Text style={s.date}>Открыто {new Date(item.unlockedAt).toLocaleDateString('ru-RU')}</Text>:null}</View>
  </View>)}</Card></Screen>
}
const s=StyleSheet.create({list:{paddingVertical:2},row:{flexDirection:'row',alignItems:'center',paddingVertical:16},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},content:{flex:1,marginLeft:13},top:{flexDirection:'row',justifyContent:'space-between'},title:{fontSize:16,fontWeight:'700'},count:{fontSize:12,color:colors.secondary},detail:{fontSize:12,color:colors.secondary,marginTop:3},date:{fontSize:10,color:colors.green,marginTop:6}});
