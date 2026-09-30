import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { AchievementMedal } from '../../AchievementMedal';
import { levelColor, type Achievement } from '../../gamification';
import { useApp } from '../../state/AppContext';
import { localDateKey, programSummary } from '../../program';
import { sessionStats } from '../../statistics';
import { techniqueStats } from '../../techniqueStats';
import { ensureGuest, isSupabaseConfigured } from '../../supabase';
import { Card, colors, LevelBadge, ListRow, Loading, PrimaryButton, ProgressBar, Screen, SectionLabel } from '../../ui';

export default function ProfileScreen() {
  const { program, history, profile, gamification, leaders, updateProfile } = useApp();
  const [avatarMenu,setAvatarMenu]=useState(false);
  const [avatarBusy,setAvatarBusy]=useState(false);
  const [nicknameMenu,setNicknameMenu]=useState(false);
  const [nicknameDraft,setNicknameDraft]=useState(profile.nickname);
  const [nicknameBusy,setNicknameBusy]=useState(false);
  if (!program) return <Loading/>;
  const summary=programSummary(program), stats=sessionStats(history), technique=techniqueStats(history), initial=(profile.nickname||'Я').slice(0,2).toUpperCase();
  const friends=leaders.filter(item=>item.userId&&item.userId!==profile.userId);
  const todayKey=localDateKey(),mainDays=program.days.filter(day=>day.kind==='main');
  const upcomingMainIndex=mainDays.findIndex(day=>day.date>=todayKey&&day.status==='upcoming');
  const mainAnchor=upcomingMainIndex>=0?upcomingMainIndex:mainDays.length-1;
  const mainWindowStart=Math.max(0,Math.min(mainAnchor-2,mainDays.length-5));
  const visibleMain=mainDays.slice(mainWindowStart,mainWindowStart+5);
  const nextMain=mainDays.find(day=>day.date>=todayKey&&day.status==='upcoming')??null;
  const todayMain=mainDays.find(day=>day.date===todayKey)??null;
  const seriesStatus=todayMain?.status==='completed'?'Серия сохранена':program.workoutStreak>0?'Серия активна':'Начни серию';
  const nextMainLabel=nextMain
    ?nextMain.date===todayKey?'Сегодня':new Date(`${nextMain.date}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})
    :'Программа завершена';
  const pickAvatar=async()=>{
    setAvatarMenu(false);
    if(Platform.OS!=='web'){
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted){Alert.alert('Нет доступа к фото','Разреши доступ к медиатеке в настройках телефона.');return;}
    }
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:'images',allowsEditing:true,aspect:[1,1],quality:.8});
    if(result.canceled)return;
    setAvatarBusy(true);
    try{
      const asset=result.assets[0],side=Math.min(asset.width,asset.height);
      const image=await manipulateAsync(asset.uri,[{crop:{originX:Math.round((asset.width-side)/2),originY:Math.round((asset.height-side)/2),width:side,height:side}},{resize:{width:512,height:512}}],{base64:true,compress:.72,format:SaveFormat.JPEG});
      if(!image.base64)throw new Error('avatar encoding failed');
      await updateProfile({...profile,avatarUri:`data:image/jpeg;base64,${image.base64}`});
    }catch{Alert.alert('Не удалось сохранить фото','Попробуй выбрать другое изображение.');}
    finally{setAvatarBusy(false);}
  };
  const removeAvatar=async()=>{setAvatarMenu(false);setAvatarBusy(true);try{await updateProfile({...profile,avatarUri:undefined});}finally{setAvatarBusy(false);}};
  const openNickname=()=>{setNicknameDraft(profile.nickname);setNicknameMenu(true);};
  const saveNickname=async()=>{
    const nickname=nicknameDraft.trim();
    if(nickname.length<2)return;
    setNicknameBusy(true);
    try{
      let identity={userId:profile.userId,friendCode:profile.friendCode};
      if(isSupabaseConfigured)identity=await ensureGuest(nickname);
      await updateProfile({...profile,...identity,nickname});
      setNicknameMenu(false);
    }catch{Alert.alert('Не удалось изменить никнейм','Проверь подключение и попробуй ещё раз.');}
    finally{setNicknameBusy(false);}
  };
  return <Screen>
    <View style={s.identity}>
      <Pressable accessibilityLabel={profile.avatarUri?'Изменить фото профиля':'Добавить фото профиля'} disabled={avatarBusy} onPress={()=>profile.avatarUri?setAvatarMenu(true):void pickAvatar()} style={({pressed})=>[s.avatarButton,pressed&&s.pressed]}>
        <View style={s.avatar}>{profile.avatarUri?<Image source={{uri:profile.avatarUri}} style={s.avatarImage}/>:<Text style={s.avatarText}>{initial}</Text>}{avatarBusy?<View style={s.avatarBusy}><ActivityIndicator color="#fff"/></View>:null}</View>
        <View style={s.cameraBadge}><Ionicons color={colors.text} name="camera" size={14}/></View>
      </Pressable>
      <Pressable accessibilityLabel="Изменить никнейм" onPress={openNickname} style={({pressed})=>[s.identityText,pressed&&s.pressed]}><View style={s.nameRow}><Text numberOfLines={1} style={s.name}>{profile.nickname||'Задать никнейм'}</Text><Ionicons color={colors.tertiary} name="pencil" size={15}/></View><View style={s.rankLine}><LevelBadge level={gamification.level} size={24}/><Text style={s.level}>{gamification.rating} PWR</Text></View></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${friends.length} друзей`} hitSlop={8} onPress={()=>router.push('/friends')} style={({pressed})=>[s.friendCount,pressed&&s.pressed]}>
        <Text style={s.friendCountValue}>{friends.length}</Text><Text style={s.friendCountLabel}>друзей</Text>
      </Pressable>
    </View>
    <Card style={s.levelCard}><View style={s.levelTop}><Text style={s.levelTitle}>{gamification.nextLevelRating?`До LVL ${gamification.level+1}`:'Максимальный уровень'}</Text><Text style={[s.levelCount,{color:levelColor(gamification.level)}]}>{gamification.nextLevelRating?`${gamification.rating} / ${gamification.nextLevelRating} PWR`:`${gamification.rating} PWR`}</Text></View><ProgressBar color={levelColor(gamification.level)} value={gamification.progress}/></Card>

    <AchievementsShelf items={gamification.achievements}/>

    <Pressable accessibilityRole="button" onPress={()=>router.push('/statistics')} style={({pressed})=>[s.techniquePress,pressed&&s.streakPressed]}>
      <Card style={s.techniqueCard}>
        <View style={s.techniqueHead}><View><Text style={s.techniqueEyebrow}>Техника</Text><Text style={s.techniqueTitle}>{technique.assessed?`${technique.assessed} ${technique.assessed===1?'разбор':'разборов'}`:'После первой тренировки'}</Text></View><View style={s.techniqueScore}><Text style={s.techniqueScoreValue}>{technique.score===null?'—':String(technique.score).replace('.',',')}</Text><Text style={s.techniqueScoreMax}>/ 10</Text></View></View>
        {technique.assessed?<><View style={s.techniqueRule}/>{technique.strengths[0]?<View style={s.techniqueRow}><View style={[s.techniqueIcon,{backgroundColor:'#EAF8EE'}]}><Ionicons color="#21843C" name="checkmark" size={16}/></View><View style={s.techniqueCopy}><Text style={s.techniqueRowLabel}>Получается</Text><Text numberOfLines={2} style={s.techniqueRowText}>{technique.strengths[0]}</Text></View></View>:null}{technique.issues[0]?<View style={s.techniqueRow}><View style={[s.techniqueIcon,{backgroundColor:colors.blueSoft}]}><Ionicons color={colors.blue} name="arrow-up" size={16}/></View><View style={s.techniqueCopy}><Text style={s.techniqueRowLabel}>Текущий фокус</Text><Text numberOfLines={2} style={s.techniqueRowText}>{technique.issues[0].label}</Text></View></View>:null}</>:<Text style={s.techniqueEmpty}>Заверши личный подход — тренер оценит технику и сохранит рекомендации здесь.</Text>}
      </Card>
    </Pressable>

    <Pressable accessibilityRole="button" onPress={()=>router.push('/program')} style={({pressed})=>[s.streakPress,pressed&&s.streakPressed]}>
      <Card style={s.streakCard}>
        <View style={s.streakHeader}>
          <View style={s.streakHeading}><View style={s.streakIcon}><Ionicons color={colors.blue} name="flame" size={19}/></View><Text style={s.streakTitle}>Серия тренировок</Text></View>
          <View style={[s.streakStatus,program.workoutStreak>0&&s.streakStatusOn]}><View style={[s.statusDot,program.workoutStreak>0&&s.statusDotOn]}/><Text style={[s.streakStatusText,program.workoutStreak>0&&s.streakStatusTextOn]}>{seriesStatus}</Text></View>
        </View>

        <View style={s.streakHero}>
          <View style={s.streakMetric}><Text style={s.streakValue}>{program.workoutStreak}</Text><View style={s.streakMetricCopy}><Text style={s.streakUnit}>основных</Text><Text style={s.streakLabel}>подряд</Text></View></View>
          <View style={s.bestStreak}><Text style={s.bestStreakLabel}>Личный рекорд</Text><Text style={s.bestStreakValue}>{program.bestWorkoutStreak}</Text></View>
        </View>

        <View style={s.streakProgressHead}><Text style={s.streakProgressTitle}>Основные тренировки</Text><Text style={s.streakProgressValue}>{summary.completed} из {summary.total}</Text></View>
        <View style={s.streakProgress}><View style={[s.streakProgressFill,{width:`${summary.adherence}%`}]}/></View>

        <View style={s.mainDays}>{visibleMain.map(day=>{
          const completed=day.status==='completed',missed=day.status==='failed'||day.status==='skipped',isToday=day.date===todayKey;
          return <View key={day.index} style={s.mainDay}>
            <Text style={[s.mainDayName,isToday&&s.mainDayNameToday]}>{new Date(`${day.date}T12:00:00`).toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','')}</Text>
            <View style={[s.mainDayDot,completed&&s.mainDayDone,missed&&s.mainDayMissed,isToday&&s.mainDayToday]}>
              {completed?<Ionicons color="#fff" name="checkmark" size={18}/>:missed?<Ionicons color="#FF8B84" name="close" size={17}/>:<Text style={[s.mainDayTarget,isToday&&s.mainDayTargetToday]}>{day.target}</Text>}
            </View>
            <Text style={[s.mainDayDate,isToday&&s.mainDayDateToday]}>{new Date(`${day.date}T12:00:00`).getDate()}</Text>
          </View>;
        })}</View>

        <View style={s.nextWorkout}>
          <View style={s.nextWorkoutIcon}><Ionicons color="#9BC8FF" name="calendar-clear-outline" size={19}/></View>
          <View style={s.nextWorkoutCopy}><Text style={s.nextWorkoutLabel}>{nextMain?'Следующая основная':'Цикл завершён'}</Text><Text style={s.nextWorkoutDate}>{nextMainLabel}</Text></View>
          {nextMain?<View style={s.nextWorkoutGoal}><Text style={s.nextWorkoutGoalValue}>{nextMain.target}</Text><Text style={s.nextWorkoutGoalLabel}>повторов</Text></View>:<Ionicons color="rgba(255,255,255,.42)" name="checkmark-circle" size={28}/>}
        </View>
      </Card>
    </Pressable>

    <SectionLabel>Статистика</SectionLabel>
    <Card style={s.totalReps}><View style={s.totalRepsIcon}><Ionicons color={colors.blue} name="barbell-outline" size={23}/></View><View style={s.totalRepsCopy}><Text style={s.totalRepsValue}>{stats.reps.toLocaleString('ru-RU')}</Text><Text style={s.totalRepsLabel}>отжиманий за всё время</Text></View></Card>
    <View style={s.grid}><Stat value={String(stats.sessions)} label="Подходов"/><Stat value={String(stats.best)} label="Лучший подход"/><Stat value={`${Math.floor(stats.seconds/60)}м`} label="В тренировках"/><Stat value={String(stats.main)} label="Основных"/></View>

    <SectionLabel>Матчи</SectionLabel>
    <Card style={s.pvp}><Result value={String(stats.wins)} label="Победы" tone="win"/><Result value={String(stats.losses)} label="Поражения" tone="loss"/><Result value={String(stats.draws)} label="Ничьи" tone="draw"/><Result value={String(stats.best60)} label="Рекорд"/></Card>

    {profile.friendCode?<Pressable onPress={()=>void Share.share({message:`Мой код друга в Rep: ${profile.friendCode}`})}><Card style={s.code}><View><Text style={s.codeLabel}>Код друга</Text><Text style={s.codeValue}>{profile.friendCode}</Text></View><Text style={s.share}>Поделиться</Text></Card></Pressable>:null}
    <Card style={s.links}><ListRow title="Подробная статистика" onPress={()=>router.push('/statistics')}/><ListRow title="История тренировок" onPress={()=>router.push('/history')}/><ListRow title="Настройки" onPress={()=>router.push('/settings')}/></Card>
    <Modal animationType="fade" onRequestClose={()=>setAvatarMenu(false)} transparent visible={avatarMenu}>
      <View style={s.modalRoot}><Pressable accessibilityLabel="Закрыть" onPress={()=>setAvatarMenu(false)} style={s.modalBackdrop}/><View style={s.avatarMenu}>
        <Text style={s.avatarMenuTitle}>Фото профиля</Text>
        <Pressable onPress={()=>void pickAvatar()} style={({pressed})=>[s.avatarAction,pressed&&s.actionPressed]}><Ionicons color={colors.blue} name="images-outline" size={21}/><Text style={s.avatarActionText}>Изменить фото</Text></Pressable>
        <Pressable onPress={()=>void removeAvatar()} style={({pressed})=>[s.avatarAction,pressed&&s.actionPressed]}><Ionicons color={colors.red} name="trash-outline" size={21}/><Text style={[s.avatarActionText,{color:colors.red}]}>Удалить фото</Text></Pressable>
        <Pressable onPress={()=>setAvatarMenu(false)} style={({pressed})=>[s.cancelAction,pressed&&s.actionPressed]}><Text style={s.cancelText}>Отмена</Text></Pressable>
      </View></View>
    </Modal>
    <Modal animationType="fade" onRequestClose={()=>setNicknameMenu(false)} transparent visible={nicknameMenu}>
      <View style={s.modalRoot}><Pressable accessibilityLabel="Закрыть" onPress={()=>setNicknameMenu(false)} style={s.modalBackdrop}/><View style={s.nicknameMenu}>
        <Text style={s.nicknameTitle}>Никнейм</Text>
        <TextInput autoFocus autoCorrect={false} maxLength={20} onChangeText={setNicknameDraft} placeholder="Твой никнейм" placeholderTextColor={colors.tertiary} returnKeyType="done" style={s.nicknameInput} value={nicknameDraft} onSubmitEditing={()=>void saveNickname()}/>
        <PrimaryButton disabled={nicknameBusy||nicknameDraft.trim().length<2} onPress={()=>void saveNickname()} title={nicknameBusy?'Сохраняем…':'Сохранить'}/>
        <Pressable onPress={()=>setNicknameMenu(false)} style={({pressed})=>[s.nicknameCancel,pressed&&s.actionPressed]}><Text style={s.cancelText}>Отмена</Text></Pressable>
      </View></View>
    </Modal>
  </Screen>;
}
function AchievementsShelf({items}:{items:Achievement[]}){
  const unlocked=items.filter(item=>item.unlockedAt).length;
  return <View style={s.achievements}>
    <Pressable accessibilityRole="button" onPress={()=>router.push('/achievements')} style={({pressed})=>[s.achievementsHead,pressed&&s.pressed]}>
      <Text style={s.achievementsTitle}>Достижения</Text>
      <View style={s.achievementsMore}><Text style={s.achievementsCount}>{unlocked} из {items.length}</Text><Ionicons color={colors.tertiary} name="chevron-forward" size={16}/></View>
    </Pressable>
    <ScrollView contentContainerStyle={s.achievementRow} horizontal showsHorizontalScrollIndicator={false}>
      {items.map(item=><View key={item.id} style={s.achievementItem}>
        <AchievementMedal id={item.id} onTurnEnd={()=>router.push({pathname:'/achievement',params:{id:item.id}})} size={78} unlocked={Boolean(item.unlockedAt)}/>
        <Text numberOfLines={2} style={[s.achievementName,!item.unlockedAt&&s.achievementNameLocked]}>{item.title}</Text>
        <Text style={[s.achievementState,item.unlockedAt&&s.achievementStateOn]}>{item.unlockedAt?'Получено':`${Math.min(item.current,item.target)} / ${item.target}`}</Text>
      </View>)}
    </ScrollView>
  </View>;
}
function Stat({value,label}:{value:string;label:string}){return <Card style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></Card>}
function Result({value,label,tone}:{value:string;label:string;tone?:'win'|'loss'|'draw'}){const color=tone?colors[tone]:undefined;return <View style={s.pvpItem}><Text style={[s.pvpValue,color&&{color}]}>{value}</Text><Text style={[s.pvpLabel,color&&{color}]}>{label}</Text></View>}
const s=StyleSheet.create({
  identity:{flexDirection:'row',alignItems:'center',paddingVertical:8},avatarButton:{width:74,height:74},avatar:{width:70,height:70,borderRadius:24,backgroundColor:colors.text,alignItems:'center',justifyContent:'center',overflow:'hidden'},avatarImage:{width:'100%',height:'100%'},avatarBusy:{position:'absolute',inset:0,backgroundColor:'rgba(8,9,10,.48)',alignItems:'center',justifyContent:'center'},cameraBadge:{position:'absolute',right:0,bottom:0,width:25,height:25,borderRadius:13,backgroundColor:colors.card,borderWidth:2,borderColor:colors.bg,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontSize:22,fontWeight:'800'},identityText:{flex:1,marginLeft:12,marginRight:8},nameRow:{flexDirection:'row',alignItems:'center',gap:7},name:{fontSize:25,fontWeight:'800',letterSpacing:-.5,flexShrink:1},rankLine:{flexDirection:'row',alignItems:'center',gap:7,marginTop:5},level:{fontSize:14,color:colors.secondary},friendCount:{minWidth:58,alignItems:'center',paddingVertical:8},friendCountValue:{fontSize:20,fontWeight:'800',color:colors.text},friendCountLabel:{fontSize:11,color:colors.secondary,marginTop:2},pressed:{opacity:.55,transform:[{scale:.97}]},levelCard:{marginTop:14},levelTop:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},levelTitle:{fontSize:14,fontWeight:'600'},levelCount:{fontSize:13,fontWeight:'700'},
  achievements:{marginTop:26,marginHorizontal:-16},achievementsHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},achievementsTitle:{fontSize:20,fontWeight:'800',letterSpacing:-.3},achievementsMore:{flexDirection:'row',alignItems:'center'},achievementsCount:{fontSize:13,color:colors.secondary,marginRight:2},achievementRow:{paddingHorizontal:16,paddingTop:13,paddingBottom:2,gap:13},achievementItem:{width:84,alignItems:'center'},achievementName:{fontSize:12,lineHeight:15,fontWeight:'700',color:colors.text,textAlign:'center',marginTop:7,minHeight:30},achievementNameLocked:{color:colors.secondary},achievementState:{fontSize:10,color:colors.secondary,marginTop:2},achievementStateOn:{color:colors.green,fontWeight:'700'},
  techniquePress:{marginTop:26},techniqueCard:{padding:20},techniqueHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},techniqueEyebrow:{fontSize:18,fontWeight:'800',color:colors.text},techniqueTitle:{fontSize:12,color:colors.secondary,marginTop:3},techniqueScore:{flexDirection:'row',alignItems:'baseline'},techniqueScoreValue:{fontSize:43,lineHeight:47,fontWeight:'800',letterSpacing:-2,color:colors.blue},techniqueScoreMax:{fontSize:13,fontWeight:'700',color:colors.secondary,marginLeft:4},techniqueRule:{height:StyleSheet.hairlineWidth,backgroundColor:colors.line,marginVertical:15},techniqueRow:{flexDirection:'row',alignItems:'center',marginTop:10},techniqueIcon:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center'},techniqueCopy:{flex:1,marginLeft:11},techniqueRowLabel:{fontSize:10,fontWeight:'700',color:colors.secondary,textTransform:'uppercase',letterSpacing:.4},techniqueRowText:{fontSize:14,lineHeight:19,fontWeight:'700',color:colors.text,marginTop:2},techniqueEmpty:{fontSize:14,lineHeight:20,color:colors.secondary,marginTop:17},
  streakPress:{marginTop:28},streakPressed:{opacity:.72,transform:[{scale:.992}]},streakCard:{minHeight:390,padding:20,backgroundColor:colors.card,borderColor:colors.line},streakHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},streakHeading:{flexDirection:'row',alignItems:'center',gap:10},streakIcon:{width:36,height:36,borderRadius:12,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},streakTitle:{fontSize:17,fontWeight:'800',color:colors.text,letterSpacing:-.2},streakStatus:{minHeight:28,borderRadius:14,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#F2F2F7'},streakStatusOn:{backgroundColor:'#EAF8EE'},statusDot:{width:6,height:6,borderRadius:3,backgroundColor:colors.tertiary},statusDotOn:{backgroundColor:colors.green},streakStatusText:{fontSize:9,fontWeight:'800',letterSpacing:.5,textTransform:'uppercase',color:colors.secondary},streakStatusTextOn:{color:'#21843C'},
  streakHero:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:26},streakMetric:{flexDirection:'row',alignItems:'flex-end'},streakValue:{fontSize:72,lineHeight:74,fontWeight:'800',letterSpacing:-4,color:colors.text},streakMetricCopy:{marginLeft:11,marginBottom:9},streakUnit:{fontSize:16,fontWeight:'700',color:colors.text},streakLabel:{fontSize:13,color:colors.secondary,marginTop:1},bestStreak:{alignItems:'flex-end',marginBottom:9},bestStreakLabel:{fontSize:10,fontWeight:'600',color:colors.secondary},bestStreakValue:{fontSize:25,fontWeight:'800',color:colors.text,marginTop:2},
  streakProgressHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22},streakProgressTitle:{fontSize:11,fontWeight:'600',color:colors.secondary},streakProgressValue:{fontSize:11,fontWeight:'700',color:colors.blue},streakProgress:{height:5,borderRadius:3,backgroundColor:'#E5E5EA',overflow:'hidden',marginTop:8},streakProgressFill:{height:5,borderRadius:3,backgroundColor:colors.blue},mainDays:{flexDirection:'row',justifyContent:'space-between',marginTop:20,paddingHorizontal:2},mainDay:{alignItems:'center',width:44},mainDayName:{fontSize:10,fontWeight:'600',textTransform:'uppercase',color:colors.tertiary},mainDayNameToday:{color:colors.blue},mainDayDot:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',marginTop:7,backgroundColor:'#F7F7F9'},mainDayDone:{backgroundColor:colors.blue,borderColor:colors.blue},mainDayMissed:{borderColor:'#FFB3AD',backgroundColor:'#FFF1F0'},mainDayToday:{borderColor:colors.blue,borderWidth:2},mainDayTarget:{fontSize:13,fontWeight:'700',color:colors.secondary},mainDayTargetToday:{color:colors.blue},mainDayDate:{fontSize:10,color:colors.tertiary,marginTop:5},mainDayDateToday:{color:colors.blue,fontWeight:'700'},
  nextWorkout:{minHeight:64,borderRadius:18,backgroundColor:'#F4F4F6',flexDirection:'row',alignItems:'center',paddingHorizontal:13,marginTop:21},nextWorkoutIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.blueSoft},nextWorkoutCopy:{flex:1,marginLeft:11},nextWorkoutLabel:{fontSize:10,fontWeight:'600',color:colors.secondary},nextWorkoutDate:{fontSize:14,fontWeight:'700',color:colors.text,marginTop:2},nextWorkoutGoal:{alignItems:'flex-end'},nextWorkoutGoalValue:{fontSize:20,fontWeight:'800',color:colors.text},nextWorkoutGoalLabel:{fontSize:9,color:colors.secondary,marginTop:-1},
  totalReps:{minHeight:112,flexDirection:'row',alignItems:'center',marginBottom:10},totalRepsIcon:{width:54,height:54,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:colors.blueSoft},totalRepsCopy:{marginLeft:15},totalRepsValue:{fontSize:35,lineHeight:39,fontWeight:'800',letterSpacing:-1,color:colors.text},totalRepsLabel:{fontSize:13,color:colors.secondary,marginTop:2},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},stat:{width:'48.5%',height:112,justifyContent:'space-between'},statValue:{fontSize:34,fontWeight:'800'},statLabel:{fontSize:12,color:colors.secondary},pvp:{flexDirection:'row',paddingHorizontal:8},pvpItem:{flex:1,alignItems:'center'},pvpValue:{fontSize:25,fontWeight:'800'},pvpLabel:{fontSize:10,color:colors.secondary,marginTop:4},code:{marginTop:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},codeLabel:{fontSize:12,color:colors.secondary},codeValue:{fontSize:22,fontWeight:'800',letterSpacing:3,marginTop:3},share:{fontSize:14,color:colors.blue,fontWeight:'600'},links:{marginTop:18,paddingVertical:0},
  modalRoot:{flex:1,justifyContent:'flex-end'},modalBackdrop:{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,.28)'},avatarMenu:{backgroundColor:colors.bg,borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:16,paddingTop:18,paddingBottom:32},avatarMenuTitle:{fontSize:14,fontWeight:'700',color:colors.secondary,textAlign:'center',marginBottom:12},avatarAction:{height:58,backgroundColor:colors.card,flexDirection:'row',alignItems:'center',paddingHorizontal:18,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},avatarActionText:{fontSize:17,fontWeight:'600',color:colors.blue,marginLeft:13},cancelAction:{height:56,backgroundColor:colors.card,borderRadius:17,alignItems:'center',justifyContent:'center',marginTop:10},cancelText:{fontSize:17,fontWeight:'700',color:colors.text},actionPressed:{opacity:.58},nicknameMenu:{backgroundColor:colors.bg,borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:20,paddingTop:22,paddingBottom:32},nicknameTitle:{fontSize:20,fontWeight:'800',color:colors.text,marginBottom:14},nicknameInput:{height:56,borderRadius:17,backgroundColor:colors.card,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,paddingHorizontal:16,fontSize:18,color:colors.text,marginBottom:14},nicknameCancel:{height:52,alignItems:'center',justifyContent:'center',marginTop:4}
});
