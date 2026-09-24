import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { Card, colors, Screen } from '../../ui';

export default function LeadersScreen() {
  const { profile, history, leaders } = useApp();
  const localWins = history.filter(item => item.mode === 'pvp' && item.pvpResult === 'win').length;
  const localReps = history.reduce((sum, item) => sum + item.reps, 0);
  const rows = leaders.length ? leaders : [{ userId: profile.userId ?? 'local', nickname: profile.nickname || 'Ты', wins: localWins, reps: localReps }];
  return <Screen>
    <Card style={s.list}>{rows.map((item, index) => <View key={item.userId} style={[s.row, index > 0 && s.line]}>
      <Text style={s.rank}>{index + 1}</Text><View style={s.avatar}><Text style={s.avatarText}>{item.nickname.slice(0, 2).toUpperCase()}</Text></View>
      <View style={s.info}><Text style={s.name}>{item.nickname}{item.nickname !== 'Ты' && (item.userId === profile.userId || item.userId === 'local') ? ' · ты' : ''}</Text><Text style={s.detail}>{item.reps} повторений за неделю</Text></View>
      <View style={s.result}><Text style={s.score}>{item.wins}</Text><Text style={s.wins}>побед</Text></View>
    </View>)}</Card>
    {leaders.length <= 1 ? <View style={s.empty}><Text style={s.emptyTitle}>Добавь соперника</Text><Text style={s.emptyCopy}>После PvP он появится здесь. Места считаются по победам за неделю, затем по повторам.</Text></View> : null}
  </Screen>;
}
const s=StyleSheet.create({list:{paddingVertical:2,marginTop:6},row:{minHeight:78,flexDirection:'row',alignItems:'center'},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},rank:{width:28,fontSize:15,fontWeight:'700',color:colors.secondary},avatar:{width:44,height:44,borderRadius:15,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},avatarText:{color:colors.blue,fontWeight:'800'},info:{flex:1,marginLeft:12},name:{fontSize:16,fontWeight:'700'},detail:{fontSize:12,color:colors.secondary,marginTop:3},result:{alignItems:'flex-end'},score:{fontSize:28,fontWeight:'800'},wins:{fontSize:10,color:colors.secondary},empty:{alignItems:'center',paddingHorizontal:40,paddingTop:150},emptyTitle:{fontSize:22,fontWeight:'700'},emptyCopy:{fontSize:15,lineHeight:21,color:colors.secondary,textAlign:'center',marginTop:8}});
