import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ensureGuest, invokePvp, isSupabaseConfigured } from '../../supabase';
import { useApp } from '../../state/AppContext';
import { sessionStats } from '../../statistics';
import { colors, LevelBadge, Screen } from '../../ui';
import PvpTopTabs from '../../PvpTopTabs';
import SwipeTabPage from '../../SwipeTabPage';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PvpStartScreen() {
  const params = useLocalSearchParams<{ code?: string; testVideo?: string }>();
  const { profile, history, gamification, updateProfile } = useApp();
  const stats = sessionStats(history);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const searching = useRef(false);
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 170, useNativeDriver: true }).start();
    return () => {
      if (searching.current && isSupabaseConfigured) void invokePvp('cancel_queue').catch(() => {});
      searching.current = false;
    };
  }, [entrance]);

  useEffect(() => {
    if (!params.code) return;
    router.replace({ pathname: '/pvp/friends', params: { code: params.code, ...(params.testVideo ? { testVideo: params.testVideo } : {}) } });
  }, [params.code, params.testVideo]);

  const openMatch = (matchId: string, roomCode = '') => {
    searching.current = false;
    router.push({ pathname: '/pvp/match', params: { matchId, nickname: profile.nickname.trim(), code: roomCode, ...(params.testVideo ? { testVideo: params.testVideo } : {}) } });
  };

  const start = async () => {
    const cleanNickname = profile.nickname.trim();
    if (cleanNickname.length < 2) { router.replace('/(tabs)/profile'); return; }
    setBusy('queue_random'); setMessage('');
    try {
      const guest = await ensureGuest(cleanNickname);
      await updateProfile({ ...profile, nickname: cleanNickname, userId: guest.userId, friendCode: guest.friendCode });
      if (!isSupabaseConfigured) {
        router.push({ pathname: '/pvp/match', params: { demo: '1', nickname: cleanNickname, opponent: 'Случайный игрок', code: '' } });
        return;
      }
      searching.current = true;
      const startedAt = Date.now();
      while (searching.current) {
        const result = await invokePvp('queue_random', { best60: stats.best60 });
        const matchId = result.matchId ?? result.match?.id;
        if (matchId) { openMatch(matchId); return; }
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setMessage(elapsed < 10 ? 'Ищем соперника твоего уровня' : elapsed < 30 ? 'Расширяем диапазон поиска' : 'Ищем среди всех игроков');
        await delay(2500);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось подключиться к матчу.');
    } finally {
      searching.current = false;
      setBusy('');
    }
  };

  const cancelSearch = () => {
    searching.current = false;
    setBusy('');
    setMessage('');
    if (isSupabaseConfigured) void invokePvp('cancel_queue').catch(() => {});
  };

  const isSearching = busy === 'queue_random';
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return <SwipeTabPage onSwipeLeft={() => router.replace({ pathname: '/pvp/friends', params: params.testVideo ? { testVideo: params.testVideo } : {} })}><Screen style={s.content}>
    <PvpTopTabs active="quick" testVideo={params.testVideo}/>
    <Animated.View style={entranceStyle}>
      <View style={s.arena}>
        <View style={s.arenaTop}>
          <View style={s.duration}><Ionicons color={colors.secondary} name="timer-outline" size={14}/><Text style={s.durationText}>60 СЕК</Text></View>
        </View>
        <View style={s.metrics}>
          <View style={s.metricPrimary}><LevelBadge level={gamification.level} size={32}/><View><Text style={s.metricValue}>{gamification.rating}</Text><Text style={s.metricLabel}>PWR</Text></View></View>
          <View style={s.metric}><Text style={s.metricValue}>{stats.best60}</Text><Text style={s.metricLabel}>РЕКОРД</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>{stats.pvp}</Text><Text style={s.metricLabel}>МАТЧЕЙ</Text></View>
        </View>

        {isSearching ? <View style={s.searchState}>
          <View style={s.searchCopy}><ActivityIndicator color={colors.blue}/><Text style={s.searchText}>{message || 'Запускаем поиск'}</Text></View>
          <Pressable accessibilityRole="button" onPress={cancelSearch} style={({ pressed }) => [s.cancel, pressed && s.pressed]}><Text style={s.cancelText}>Отменить</Text></Pressable>
        </View> : <Pressable accessibilityRole="button" disabled={!!busy} onPress={() => void start()} style={({ pressed }) => [s.searchButton, pressed && s.searchButtonPressed, !!busy && s.disabled]}>
          <Text style={s.searchButtonText}>Найти соперника</Text><View style={s.searchArrow}><Ionicons color={colors.blue} name="arrow-forward" size={20}/></View>
        </Pressable>}
      </View>
    </Animated.View>

  </Screen></SwipeTabPage>;
}

const s = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 80 },
  arena: { borderRadius: 28, padding: 22, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  arenaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  duration: { height: 28, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F2F2F7' },
  durationText: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: .7 },
  metrics: { minHeight: 76, flexDirection: 'row', alignItems: 'center', marginTop: 18, borderRadius: 18, paddingHorizontal: 14, backgroundColor: '#F4F4F6' },
  metricPrimary: { flex: 1.25, flexDirection: 'row', alignItems: 'center', gap: 9 },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.text, fontSize: 19, lineHeight: 22, fontWeight: '800' },
  metricLabel: { color: colors.secondary, fontSize: 8, fontWeight: '800', letterSpacing: .8, marginTop: 2 },
  searchButton: { minHeight: 60, borderRadius: 19, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 19, paddingRight: 7, marginTop: 22 },
  searchButtonPressed: { opacity: .84, transform: [{ scale: .985 }] },
  searchButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  searchArrow: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchState: { minHeight: 60, borderRadius: 19, backgroundColor: '#F2F2F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, marginTop: 22 },
  searchCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  cancel: { minHeight: 36, justifyContent: 'center', paddingLeft: 12 }, cancelText: { color: '#FF8B84', fontSize: 13, fontWeight: '700' },
  privateSection: { marginTop: 28 }, sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -.35, marginLeft: 2, marginBottom: 12 },
  privateSurface: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  createRoom: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
  roomIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blueSoft },
  roomCopy: { flex: 1, marginLeft: 13 }, roomTitle: { color: colors.text, fontSize: 16, fontWeight: '700' }, roomDetail: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 74 },
  joinBlock: { paddingHorizontal: 17, paddingTop: 16, paddingBottom: 18 }, joinLabel: { color: colors.secondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 9 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeInput: { flex: 1, height: 56, borderRadius: 17, paddingHorizontal: 17, color: colors.text, backgroundColor: '#F2F2F7', fontSize: 21, fontWeight: '800', letterSpacing: 5 },
  joinButton: { width: 56, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text },
  joinButtonDisabled: { backgroundColor: '#D8D8DD' }, joinButtonPressed: { opacity: .72, transform: [{ scale: .96 }] },
  error: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFE9E7', marginTop: 12 },
  errorText: { flex: 1, color: '#9F2C25', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  disabled: { opacity: .45 }, pressed: { opacity: .58 }, rowPressed: { backgroundColor: '#F7F7FA' },
});
