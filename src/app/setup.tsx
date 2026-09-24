import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, PrimaryButton } from '../ui';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { createProgram, suggestedBaseline } = useApp();
  const [value, setValue] = useState(Math.max(1, suggestedBaseline));
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); await createProgram(value); router.replace('/(tabs)/home'); };
  return <View style={[s.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]}>
    <View><Text style={s.logo}>Rep</Text><Text style={s.title}>Твоя программа на 30 дней</Text><Text style={s.copy}>Укажи комфортный подход обычных отжиманий. Не максимум.</Text></View>
    <View style={s.picker}>
      <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить" onPress={() => setValue(v => Math.max(1, v - 1))} style={s.control}><Text style={s.sign}>−</Text></Pressable>
      <View><Text style={s.number}>{value}</Text><Text style={s.unit}>ОТЖИМАНИЙ</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Увеличить" onPress={() => setValue(v => Math.min(100, v + 1))} style={s.control}><Text style={s.sign}>+</Text></Pressable>
    </View>
    <PrimaryButton title={saving ? 'Сохраняем…' : 'Начать программу'} disabled={saving} onPress={() => void submit()}/>
  </View>;
}
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.bg,paddingHorizontal:24,justifyContent:'space-between'},logo:{fontSize:24,fontWeight:'800'},title:{fontSize:40,lineHeight:43,fontWeight:'800',letterSpacing:-1.5,marginTop:42,maxWidth:350},copy:{fontSize:17,lineHeight:23,color:colors.secondary,marginTop:16,maxWidth:330},picker:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},control:{width:64,height:64,borderRadius:32,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line},sign:{fontSize:32,color:colors.blue,fontWeight:'400'},number:{fontSize:96,lineHeight:104,fontWeight:'800',textAlign:'center',letterSpacing:-5},unit:{fontSize:11,fontWeight:'700',color:colors.secondary,textAlign:'center',letterSpacing:1},
});
