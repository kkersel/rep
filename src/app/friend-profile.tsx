import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AchievementMedal } from '../AchievementMedal';
import { fetchFriendProfile, type FriendProfile } from '../supabase';
import { Card, colors, LevelBadge, Loading, Screen, SectionLabel } from '../ui';

export default function FriendProfileScreen(){
  const {userId:rawUserId}=useLocalSearchParams<{userId?:string|string[]}>();
  const userId=Array.isArray(rawUserId)?rawUserId[0]:rawUserId;
  const [friend,setFriend]=useState<FriendProfile|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!userId)return;
    let active=true;
    fetchFriendProfile(userId).then(value=>{if(active)setFriend(value)}).catch(()=>{if(active)setError('Не удалось загрузить профиль')});
    return()=>{active=false};
  },[userId]);
  if(!userId)return <Screen><Stack.Screen options={{title:'Профиль'}}/><Card><Text style={s.error}>Профиль не найден</Text></Card></Screen>;
  if(!friend&&!error)return <><Stack.Screen options={{title:'Профиль'}}/><Loading/></>;
  if(!friend)return <Screen><Stack.Screen options={{title:'Профиль'}}/><Card><Text style={s.error}>{error}</Text></Card></Screen>;
  const {stats}=friend,unlocked=friend.achievements.filter(item=>item.unlockedAt).length;
  return <Screen>
    <Stack.Screen options={{title:friend.nickname}}/>
    <View style={s.identity}><View style={s.avatar}><Text style={s.avatarText}>{friend.nickname.slice(0,2).toUpperCase()}</Text></View><View><Text style={s.name}>{friend.nickname}</Text><View style={s.rankLine}><LevelBadge level={friend.level} size={24}/><Text style={s.level}>{friend.rating} PWR</Text></View></View></View>
    <SectionLabel>Статистика</SectionLabel>
    <View style={s.grid}><Stat value={String(stats.reps)} label="Повторений"/><Stat value={String(stats.sessions)} label="Тренировок"/><Stat value={String(stats.best)} label="Лучший подход"/><Stat value={`${Math.floor(stats.seconds/60)}м`} label="В тренировках"/></View>
    <SectionLabel>Матчи</SectionLabel>
    <Card style={s.matches}><Result value={String(stats.wins)} label="Победы" tone="win"/><Result value={String(stats.losses)} label="Поражения" tone="loss"/><Result value={String(stats.draws)} label="Ничьи" tone="draw"/><Result value={String(stats.best60)} label="Рекорд"/></Card>
    <View style={s.achievementHead}><Text style={s.sectionTitle}>Достижения</Text><Text style={s.count}>{unlocked} из {friend.achievements.length}</Text></View>
    <View style={s.medals}>{friend.achievements.map(item=><View key={item.id} style={s.medal}>
      <AchievementMedal id={item.id} onTurnEnd={()=>router.push({pathname:'/achievement',params:{id:item.id,friendId:friend.userId}})} size={82} unlocked={Boolean(item.unlockedAt)}/><Text numberOfLines={2} style={[s.medalName,!item.unlockedAt&&s.locked]}>{item.title}</Text><Text style={[s.medalProgress,item.unlockedAt&&s.done]}>{item.unlockedAt?'Получено':`${Math.min(item.current,item.target)} / ${item.target}`}</Text>
    </View>)}</View>
  </Screen>;
}

function Stat({value,label}:{value:string;label:string}){return <Card style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></Card>}
function Result({value,label,tone}:{value:string;label:string;tone?:'win'|'loss'|'draw'}){const color=tone?colors[tone]:undefined;return <View style={s.result}><Text style={[s.resultValue,color&&{color}]}>{value}</Text><Text style={[s.resultLabel,color&&{color}]}>{label}</Text></View>}

const s=StyleSheet.create({
  identity:{flexDirection:'row',alignItems:'center',paddingVertical:8},avatar:{width:70,height:70,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.text,marginRight:13},avatarText:{fontSize:21,fontWeight:'800',color:'#fff'},name:{fontSize:25,fontWeight:'800',letterSpacing:-.5},rankLine:{flexDirection:'row',alignItems:'center',gap:7,marginTop:5},level:{fontSize:14,color:colors.secondary},error:{fontSize:15,color:colors.secondary,textAlign:'center'},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{width:'48.5%',height:112,justifyContent:'space-between'},statValue:{fontSize:34,fontWeight:'800'},statLabel:{fontSize:12,color:colors.secondary},matches:{flexDirection:'row',paddingHorizontal:8},result:{flex:1,alignItems:'center'},resultValue:{fontSize:25,fontWeight:'800'},resultLabel:{fontSize:10,color:colors.secondary,marginTop:4},achievementHead:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',marginTop:28,marginBottom:13,paddingHorizontal:4},sectionTitle:{fontSize:20,fontWeight:'800',letterSpacing:-.3},count:{fontSize:13,color:colors.secondary},medals:{flexDirection:'row',flexWrap:'wrap',columnGap:18,rowGap:20},medal:{width:'29%',alignItems:'center'},medalName:{fontSize:12,lineHeight:15,fontWeight:'700',textAlign:'center',marginTop:7,minHeight:30},locked:{color:colors.secondary},medalProgress:{fontSize:10,color:colors.secondary,marginTop:2},done:{color:colors.green,fontWeight:'700'},
});
