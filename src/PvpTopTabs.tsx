import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from './ui';

type PvpTab = 'quick' | 'friends';

export default function PvpTopTabs({ active, testVideo = '' }: { active: PvpTab; testVideo?: string }) {
  const open = (next: PvpTab) => {
    if (next === active) return;
    router.replace({
      pathname: next === 'quick' ? '/pvp' : '/pvp/friends',
      params: testVideo ? { testVideo } : {},
    });
  };

  return <View accessibilityRole="tablist" style={s.tabs}>
    <Tab active={active === 'quick'} label="Быстрый матч" onPress={() => open('quick')}/>
    <Tab active={active === 'friends'} label="С друзьями" onPress={() => open('friends')}/>
  </View>;
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={({ pressed }) => [s.tab, active && s.tabActive, pressed && !active && s.tabPressed]}
  >
    <Text style={[s.label, active && s.labelActive]}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  tabs: { height: 44, flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: '#E4E4EA', marginBottom: 18 },
  tab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabPressed: { opacity: .62 },
  label: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  labelActive: { color: colors.text },
});
