import React from'react';
import{Pressable,StyleSheet,Text,View}from'react-native';
import{router}from'expo-router';
import{useApp}from'../../state/AppContext';
import{Card,colors,LevelBadge,Screen,Segmented}from'../../ui';
import SwipeTabPage from '../../SwipeTabPage';
type Board='pvp'|'program';
export default function LeadersScreen(){
 const{profile,history,leaders,gamification}=useApp(),[board,setBoard]=React.useState<Board>('pvp');
 const now=new Date(),weekday=(now.getDay()+6)%7,weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-weekday).getTime();
 const weekly=history.filter(item=>+new Date(item.date)>=weekStart),pvp=history.filter(i=>i.mode==='pvp'),local={userId:profile.userId??'local',nickname:profile.nickname||'Ты',rating:gamification.rating,level:gamification.level,wins:pvp.filter(i=>i.pvpResult==='win').length,reps:history.reduce((s,i)=>s+i.reps,0),matches:pvp.length,best60:pvp.reduce((b,i)=>Math.max(b,i.reps),0),mainCompleted:weekly.filter(i=>i.mode==='program'&&i.reps>=i.goal).length,adherence:Math.round(weekly.filter(i=>i.mode==='program'&&i.reps>=i.goal).length/3*100),streak:0};
 const source=leaders.length?leaders:[local],rows=[...source].sort(board==='pvp'?(a,b)=>b.rating-a.rating||b.wins-a.wins||b.best60-a.best60:(a,b)=>b.mainCompleted-a.mainCompleted||b.adherence-a.adherence||b.streak-a.streak);
 return <SwipeTabPage onSwipeLeft={board==='pvp'?()=>setBoard('program'):undefined} onSwipeRight={board==='program'?()=>setBoard('pvp'):undefined}><Screen><Segmented value={board} onChange={setBoard} options={[{value:'pvp',label:'Матчи'},{value:'program',label:'Программа'}]}/>
  <Card style={s.list}>{rows.map((item,index)=>{const self=item.userId===profile.userId||item.userId==='local';return <Pressable disabled={self} key={item.userId} onPress={()=>router.push({pathname:'/friend-profile',params:{userId:item.userId}})} style={({pressed})=>[s.row,index>0&&s.line,pressed&&!self&&s.pressed]}><Text style={s.rank}>{index+1}</Text><View style={s.avatar}><Text style={s.avatarText}>{item.nickname.slice(0,2).toUpperCase()}</Text></View><View style={s.info}><Text style={s.name}>{item.nickname}{self?' · ты':''}</Text>{board==='pvp'?<View style={s.detailRow}><LevelBadge level={item.level} size={20}/><Text style={s.detail}>{item.matches} матчей</Text></View>:<Text style={s.detail}>{item.adherence}% плана · серия {item.streak}</Text>}</View><View style={s.result}><Text style={s.score}>{board==='pvp'?item.rating:item.mainCompleted}</Text><Text style={s.unit}>{board==='pvp'?'PWR':'основных'}</Text></View></Pressable>})}</Card>
 </Screen></SwipeTabPage>
}
const s=StyleSheet.create({list:{paddingVertical:2},row:{minHeight:78,flexDirection:'row',alignItems:'center'},pressed:{opacity:.55},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},rank:{width:28,fontSize:15,fontWeight:'700',color:colors.secondary},avatar:{width:44,height:44,borderRadius:15,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},avatarText:{color:colors.blue,fontWeight:'800'},info:{flex:1,marginLeft:12},name:{fontSize:16,fontWeight:'700'},detailRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},detail:{fontSize:11,color:colors.secondary,marginTop:3},result:{alignItems:'flex-end'},score:{fontSize:28,fontWeight:'800'},unit:{fontSize:9,color:colors.secondary}});
