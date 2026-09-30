import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '../state/AppContext';
import { invokePvp, isSupabaseConfigured } from '../supabase';
import { Card, colors, LevelBadge, PrimaryButton, Screen, SectionLabel } from '../ui';

export default function FriendsScreen() {
  const { profile, leaders, refreshLeaders } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [message, setMessage] = useState('');
  const friends = leaders.filter(item => item.userId && item.userId !== profile.userId);
  const add = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setMessage('');
    try {
      await invokePvp('add_friend_code', { code });
      setCode('');
      setMessage('Друг добавлен');
      await refreshLeaders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось добавить');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (userId: string) => {
    setRemovingId(userId);
    setMessage('');
    try {
      await invokePvp('remove_friend', { friendId: userId });
      await refreshLeaders();
      setMessage('Друг удалён');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось удалить друга');
    } finally {
      setRemovingId('');
    }
  };
  const confirmRemove = (userId: string, nickname: string) => {
    if (Platform.OS === 'web') {
      const confirm = (globalThis as typeof globalThis & { confirm?: (message: string) => boolean }).confirm;
      if (confirm?.(`Удалить ${nickname} из друзей?`)) void remove(userId);
      return;
    }
    Alert.alert('Удалить из друзей?', nickname, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void remove(userId) },
    ]);
  };

  return <Screen>
    {profile.friendCode ? <Card style={s.codeCard}>
      <View><Text style={s.caption}>Твой код</Text><Text style={s.ownCode}>{profile.friendCode}</Text></View>
      <PrimaryButton title="Поделиться" tone="plain" onPress={() => void Share.share({ message: `Мой код друга в Rep: ${profile.friendCode}` })}/>
    </Card> : null}

    <SectionLabel>Добавить</SectionLabel>
    <Card>
      <TextInput
        autoCapitalize="characters"
        maxLength={6}
        onChangeText={value => setCode(value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
        placeholder="КОД"
        placeholderTextColor={colors.tertiary}
        style={s.input}
        value={code}
      />
      <PrimaryButton title={busy ? 'Добавляем…' : 'Добавить'} disabled={busy || code.length !== 6 || !isSupabaseConfigured} onPress={() => void add()}/>
      {message ? <Text style={s.message}>{message}</Text> : null}
    </Card>

    {friends.length ? <><SectionLabel>Друзья</SectionLabel><Card style={s.list}>
      {friends.map((friend, index) => <Pressable accessibilityRole="button" key={friend.userId} onPress={()=>router.push({pathname:'/friend-profile',params:{userId:friend.userId}})} style={({pressed})=>[s.friend,index>0&&s.line,pressed&&s.pressed]}>
        <View style={s.avatar}><Text style={s.avatarText}>{friend.nickname.slice(0, 2).toUpperCase()}</Text></View>
        <View style={s.info}><Text style={s.name}>{friend.nickname}</Text><View style={s.rankLine}><LevelBadge level={friend.level} size={20}/><Text style={s.detail}>{friend.rating} PWR</Text></View></View>
        <Pressable
          accessibilityLabel={`Удалить ${friend.nickname} из друзей`}
          accessibilityRole="button"
          disabled={removingId === friend.userId}
          hitSlop={10}
          onPress={event=>{event.stopPropagation();confirmRemove(friend.userId,friend.nickname)}}
          style={({pressed})=>[s.remove,pressed&&s.removePressed]}
        >{removingId===friend.userId?<ActivityIndicator color={colors.red} size="small"/>:<Ionicons color={colors.red} name="person-remove-outline" size={20}/>}</Pressable>
      </Pressable>)}
    </Card></> : null}
  </Screen>;
}

const s = StyleSheet.create({
  codeCard:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},caption:{fontSize:12,color:colors.secondary},ownCode:{fontSize:24,fontWeight:'800',letterSpacing:4,marginTop:3},
  input:{height:58,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,fontSize:26,fontWeight:'800',letterSpacing:7,textAlign:'center',marginBottom:14},message:{fontSize:12,color:colors.secondary,textAlign:'center',marginTop:10},
  list:{paddingVertical:2},friend:{height:68,flexDirection:'row',alignItems:'center'},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},pressed:{opacity:.55},avatar:{width:42,height:42,borderRadius:14,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:13,fontWeight:'800',color:colors.blue},info:{flex:1,marginLeft:12},name:{fontSize:16,fontWeight:'700'},rankLine:{flexDirection:'row',alignItems:'center',gap:6,marginTop:3},detail:{fontSize:12,color:colors.secondary},remove:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,69,58,.08)'},removePressed:{opacity:.55,transform:[{scale:.94}]}
});
