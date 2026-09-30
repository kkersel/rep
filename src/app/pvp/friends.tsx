import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import PvpTopTabs from '../../PvpTopTabs';
import { ensureGuest, invokePvp, isSupabaseConfigured } from '../../supabase';
import { useApp } from '../../state/AppContext';
import { colors, Screen } from '../../ui';
import SwipeTabPage from '../../SwipeTabPage';

export default function FriendMatchScreen() {
  const params = useLocalSearchParams<{ code?: string; testVideo?: string }>();
  const { profile, updateProfile } = useApp();
  const [code, setCode] = useState((params.code || '').slice(0, 6).toUpperCase());
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 170, useNativeDriver: true }).start();
  }, [entrance]);

  const openMatch = (matchId: string, roomCode = '') => {
    router.push({
      pathname: '/pvp/match',
      params: { matchId, nickname: profile.nickname.trim(), code: roomCode, ...(params.testVideo ? { testVideo: params.testVideo } : {}) },
    });
  };

  const start = async (action: 'create_private' | 'join_private') => {
    const cleanNickname = profile.nickname.trim();
    if (cleanNickname.length < 2) { router.replace('/(tabs)/profile'); return; }
    setBusy(action);
    setMessage('');
    try {
      const guest = await ensureGuest(cleanNickname);
      await updateProfile({ ...profile, nickname: cleanNickname, userId: guest.userId, friendCode: guest.friendCode });
      if (!isSupabaseConfigured) {
        router.push({ pathname: '/pvp/match', params: { demo: '1', nickname: cleanNickname, opponent: 'Друг', code: action === 'create_private' ? 'DEMO01' : code } });
        return;
      }
      const result = await invokePvp(action, action === 'join_private' ? { code: code.trim().toUpperCase() } : {});
      const matchId = result.matchId ?? result.match?.id;
      if (!matchId) throw new Error('Матч не создан.');
      openMatch(matchId, result.code ?? result.match?.code ?? '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось подключиться к матчу.');
    } finally {
      setBusy('');
    }
  };

  const joinEnabled = !busy && code.trim().length === 6;
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return <SwipeTabPage onSwipeRight={() => router.replace({ pathname: '/pvp', params: params.testVideo ? { testVideo: params.testVideo } : {} })}><Screen style={s.content}>
    <PvpTopTabs active="friends" testVideo={params.testVideo}/>
    <Animated.View style={entranceStyle}>
      <View style={s.surface}>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void start('create_private')} style={({ pressed }) => [s.createRoom, pressed && s.rowPressed, !!busy && s.disabled]}>
          <View style={s.roomIcon}><Ionicons color={colors.blue} name="people-outline" size={22}/></View>
          <View style={s.roomCopy}>
            <Text style={s.roomTitle}>{busy === 'create_private' ? 'Создаём комнату…' : 'Создать комнату'}</Text>
            <Text style={s.roomDetail}>Получи код и отправь его другу</Text>
          </View>
          {busy === 'create_private' ? <ActivityIndicator color={colors.blue}/> : <Ionicons color={colors.tertiary} name="chevron-forward" size={21}/>} 
        </Pressable>
        <View style={s.separator}/>
        <View style={s.joinBlock}>
          <Text style={s.joinLabel}>КОД КОМНАТЫ</Text>
          <View style={s.joinRow}>
            <TextInput
              accessibilityLabel="Код комнаты"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              onChangeText={value => setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              onSubmitEditing={() => joinEnabled && void start('join_private')}
              placeholder="000000"
              placeholderTextColor="#C2C2C7"
              returnKeyType="go"
              style={s.codeInput}
              value={code}
            />
            <Pressable accessibilityLabel="Войти в комнату" accessibilityRole="button" disabled={!joinEnabled} onPress={() => void start('join_private')} style={({ pressed }) => [s.joinButton, !joinEnabled && s.joinButtonDisabled, pressed && joinEnabled && s.joinButtonPressed]}>
              {busy === 'join_private' ? <ActivityIndicator color="#fff"/> : <Ionicons color="#fff" name="arrow-forward" size={21}/>} 
            </Pressable>
          </View>
        </View>
      </View>
      {message ? <View style={s.error}><Ionicons color={colors.red} name="alert-circle-outline" size={17}/><Text style={s.errorText}>{message}</Text></View> : null}
    </Animated.View>
  </Screen></SwipeTabPage>;
}

const s = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 80 },
  surface: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  createRoom: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
  roomIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  roomCopy: { flex: 1, marginLeft: 13 },
  roomTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  roomDetail: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 76 },
  joinBlock: { paddingHorizontal: 17, paddingTop: 18, paddingBottom: 20 },
  joinLabel: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 9 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeInput: { flex: 1, height: 58, borderRadius: 17, paddingHorizontal: 17, color: colors.text, backgroundColor: '#F2F2F7', fontSize: 21, fontWeight: '800', letterSpacing: 5 },
  joinButton: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text },
  joinButtonDisabled: { backgroundColor: '#D8D8DD' },
  joinButtonPressed: { opacity: .72, transform: [{ scale: .96 }] },
  error: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', marginTop: 12 },
  errorText: { flex: 1, color: '#9F2C25', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  disabled: { opacity: .45 },
  rowPressed: { backgroundColor: '#F7F7FA' },
});
