import React,{useState}from'react';
import{Alert,Share,StyleSheet,Switch,Text,TextInput,View}from'react-native';
import{router}from'expo-router';
import{useApp}from'../state/AppContext';
import{ensureGuest,isSupabaseConfigured,supabase}from'../supabase';
import{Card,colors,ListRow,PrimaryButton,Screen,SectionLabel}from'../ui';

export default function SettingsScreen(){
 const{profile,history,updateProfile,resetData}=useApp(),[nickname,setNickname]=useState(profile.nickname),[busy,setBusy]=useState(false);
 const save=async()=>{const clean=nickname.trim();if(clean.length<2)return;setBusy(true);try{let identity={userId:profile.userId,friendCode:profile.friendCode};if(isSupabaseConfigured){const guest=await ensureGuest(clean);identity=guest}await updateProfile({...profile,...identity,nickname:clean});}finally{setBusy(false)}};
 const toggle=(key:keyof typeof profile.preferences)=>void updateProfile({...profile,preferences:{...profile.preferences,[key]:!profile.preferences[key]}});
 const clear=()=>Alert.alert('Сбросить данные?','Программа, история и профиль будут удалены с этого устройства.',[{text:'Отмена',style:'cancel'},{text:'Сбросить',style:'destructive',onPress:()=>void resetData().then(()=>router.replace('/setup'))}]);
 const logout=()=>Alert.alert('Выйти из гостевого профиля?','Локальная история останется на устройстве.',[{text:'Отмена',style:'cancel'},{text:'Выйти',style:'destructive',onPress:()=>void supabase?.auth.signOut().then(()=>updateProfile({...profile,userId:undefined,friendCode:undefined}))}]);
 return <Screen>
  <SectionLabel>Профиль</SectionLabel><Card><Text style={s.label}>Никнейм</Text><TextInput value={nickname} onChangeText={setNickname} maxLength={20} style={s.input}/><PrimaryButton title={busy?'Сохраняем…':'Сохранить'} disabled={busy||nickname.trim().length<2} onPress={()=>void save()}/></Card>
  <SectionLabel>Тренировки</SectionLabel><Card style={s.toggles}><Toggle title="Голосовые подсказки" value={profile.preferences.voice} onChange={()=>toggle('voice')}/><Toggle title="Вибрация" value={profile.preferences.haptics} onChange={()=>toggle('haptics')}/><Toggle title="Звуки старта и финиша" value={profile.preferences.sounds} onChange={()=>toggle('sounds')}/></Card>
  <SectionLabel>Приватность</SectionLabel><Card style={s.toggles}><Toggle title="Скрытый профиль" value={profile.preferences.privateProfile} onChange={()=>toggle('privateProfile')}/><ListRow title="Экспортировать статистику" onPress={()=>void Share.share({message:JSON.stringify({profile:{nickname:profile.nickname},history},null,2)})}/></Card>
  <SectionLabel>Данные</SectionLabel><Card style={s.toggles}>{profile.userId?<ListRow title="Выйти из гостевого профиля" onPress={logout}/>:null}<ListRow title="Сбросить локальные данные" destructive onPress={clear}/></Card>
 </Screen>
}
function Toggle({title,value,onChange}:{title:string;value:boolean;onChange:()=>void}){return <View style={s.toggle}><Text style={s.toggleText}>{title}</Text><Switch value={value} onValueChange={onChange} trackColor={{true:colors.green}}/></View>}
const s=StyleSheet.create({label:{fontSize:12,color:colors.secondary,fontWeight:'600'},input:{height:50,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,fontSize:18,marginBottom:16},toggles:{paddingVertical:0},toggle:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},toggleText:{fontSize:16,fontWeight:'600'}});
