import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ensureGuest, invokePvp, isSupabaseConfigured } from '../../supabase';
import { useApp } from '../../state/AppContext';
import { Card, colors, PrimaryButton, Screen, SectionLabel } from '../../ui';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function PvpStartScreen() {
  const params = useLocalSearchParams<{ code?: string; testVideo?: string }>();
  const { profile, history, updateProfile } = useApp();
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [code, setCode] = useState((params.code || '').slice(0, 6).toUpperCase());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const searching = useRef(false);

  useEffect(() => () => {
    if (searching.current && isSupabaseConfigured) void invokePvp('cancel_queue').catch(() => {});
    searching.current = false;
  }, []);

  const openMatch = (matchId: string, roomCode = '') => {
    searching.current = false;
    router.push({ pathname: '/pvp/match', params: { matchId, nickname: nickname.trim(), code: roomCode, ...(params.testVideo ? { testVideo: params.testVideo } : {}) } });
  };

  const start = async (action: 'create_private' | 'join_private' | 'queue_random') => {
    const cleanNickname = nickname.trim();
    if (cleanNickname.length < 2) { setError('Введи никнейм от 2 символов.'); return; }
    setBusy(action); setError('');
    try {
      const guest = await ensureGuest(cleanNickname);
      await updateProfile({ ...profile, nickname: cleanNickname, userId: guest.userId, friendCode: guest.friendCode });
      if (!isSupabaseConfigured) {
        router.push({ pathname: '/pvp/match', params: { demo: '1', nickname: cleanNickname, opponent: action === 'queue_random' ? 'Случайный игрок' : 'Друг', code: action === 'create_private' ? 'DEMO01' : '' } });
        return;
      }
      if (action !== 'queue_random') {
        const result = await invokePvp(action, action === 'join_private' ? { code: code.trim().toUpperCase() } : {});
        const matchId = result.matchId ?? result.match?.id;
        if (!matchId) throw new Error('Матч не создан.');
        openMatch(matchId, result.code ?? result.match?.code ?? '');
        return;
      }

      searching.current = true;
      const best60 = history.filter(item => item.mode === 'pvp').reduce((best, item) => Math.max(best, item.reps), 0);
      const startedAt = Date.now();
      while (searching.current) {
        const result = await invokePvp('queue_random', { best60 });
        const matchId = result.matchId ?? result.match?.id;
        if (matchId) { openMatch(matchId); return; }
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setError(elapsed < 10 ? 'Ищем соперника рядом по уровню…' : elapsed < 30 ? 'Расширяем поиск…' : 'Ищем среди всех игроков…');
        await delay(2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подключиться к PvP.');
    } finally {
      searching.current = false;
      setBusy('');
    }
  };

  const cancelSearch = () => {
    searching.current = false;
    setBusy('');
    setError('');
    if (isSupabaseConfigured) void invokePvp('cancel_queue').catch(() => {});
  };

  return <Screen>
    <Card><Text style={s.label}>Никнейм</Text><TextInput value={nickname} onChangeText={setNickname} maxLength={20} placeholder="Например, Алекс" placeholderTextColor={colors.tertiary} style={s.input}/></Card>
    <SectionLabel>Быстрый матч</SectionLabel>
    <PrimaryButton title={busy === 'queue_random' ? 'Отменить поиск' : 'Случайный соперник'} tone={busy === 'queue_random' ? 'plain' : 'blue'} disabled={!!busy && busy !== 'queue_random'} onPress={() => busy === 'queue_random' ? cancelSearch() : void start('queue_random')}/>
    <SectionLabel>Приватная комната</SectionLabel>
    <Card><PrimaryButton title={busy === 'create_private' ? 'Создаём…' : 'Создать комнату'} tone="dark" disabled={!!busy} onPress={() => void start('create_private')}/>
      <View style={s.or}><View style={s.line}/><Text style={s.orText}>или</Text><View style={s.line}/></View>
      <TextInput value={code} onChangeText={value => setCode(value.toUpperCase())} autoCapitalize="characters" maxLength={6} placeholder="КОД" placeholderTextColor={colors.tertiary} style={[s.input, s.code]}/>
      <PrimaryButton title="Войти по коду" tone="plain" disabled={!!busy || code.trim().length < 6} onPress={() => void start('join_private')}/>
    </Card>
    {error ? <Text style={s.error}>{error}</Text> : null}
  </Screen>;
}

const s = StyleSheet.create({
  label:{fontSize:13,color:colors.secondary,fontWeight:'600'}, input:{fontSize:18,color:colors.text,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},
  or:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:16}, line:{height:StyleSheet.hairlineWidth,backgroundColor:colors.line,flex:1}, orText:{fontSize:12,color:colors.secondary},
  code:{textAlign:'center',letterSpacing:8,fontWeight:'800',fontSize:24,marginBottom:12}, error:{color:colors.red,textAlign:'center',fontSize:13,marginTop:14},
});
