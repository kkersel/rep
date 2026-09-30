import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { PROGRAM_DIFFICULTIES, recommendedProgramDifficulty, type ProgramDifficulty } from '../program';
import { colors, PrimaryButton } from '../ui';

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { createProgram, suggestedBaseline } = useApp();
  const [value, setValue] = useState(Math.max(1, suggestedBaseline));
  const recommended = recommendedProgramDifficulty(value);
  const [difficultyOverride, setDifficultyOverride] = useState<ProgramDifficulty|null>(null);
  const difficulty = difficultyOverride ?? recommended;
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await createProgram(value, difficulty);
      router.replace('/(tabs)/home');
    } finally {
      setSaving(false);
    }
  };
  return <View style={[s.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }]}>
    <View><Text style={s.logo}>Rep</Text><Text style={s.title}>Твоя программа на 30 дней</Text><Text style={s.copy}>Сколько обычных отжиманий уверенно делаешь за один подход?</Text></View>
    <View>
      <View style={s.picker}>
        <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить" onPress={() => setValue(v => Math.max(1, v - 1))} style={({pressed})=>[s.control,pressed&&s.pressed]}><Text style={s.sign}>−</Text></Pressable>
        <View><Text style={s.number}>{value}</Text><Text style={s.unit}>ОТЖИМАНИЙ</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Увеличить" onPress={() => setValue(v => Math.min(100, v + 1))} style={({pressed})=>[s.control,pressed&&s.pressed]}><Text style={s.sign}>+</Text></Pressable>
      </View>
      <View style={s.difficultyHeader}><Text style={s.difficultyTitle}>Сложность</Text><Text style={s.recommendation}>Рекомендуем · {PROGRAM_DIFFICULTIES.find(item=>item.id===recommended)?.label}</Text></View>
      <View style={s.options}>{PROGRAM_DIFFICULTIES.map(option=><Pressable accessibilityRole="button" key={option.id} onPress={()=>setDifficultyOverride(option.id)} style={({pressed})=>[s.option,difficulty===option.id&&s.optionActive,pressed&&s.pressed]}>
        <Text style={[s.optionLabel,difficulty===option.id&&s.optionLabelActive]}>{option.label}</Text><Text style={s.optionCaption}>{option.caption}</Text>
      </Pressable>)}</View>
      <Text style={s.description}>{PROGRAM_DIFFICULTIES.find(item=>item.id===difficulty)?.description}</Text>
    </View>
    <PrimaryButton title={saving ? 'Сохраняем…' : 'Начать программу'} disabled={saving} onPress={() => void submit()}/>
  </View>;
}
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.bg,paddingHorizontal:24,justifyContent:'space-between'},logo:{fontSize:24,fontWeight:'800'},title:{fontSize:36,lineHeight:39,fontWeight:'800',letterSpacing:-1.3,marginTop:32,maxWidth:350},copy:{fontSize:16,lineHeight:22,color:colors.secondary,marginTop:13,maxWidth:340},picker:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},control:{width:58,height:58,borderRadius:29,backgroundColor:colors.card,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line},pressed:{opacity:.65,transform:[{scale:.97}]},sign:{fontSize:30,color:colors.blue,fontWeight:'400'},number:{fontSize:78,lineHeight:84,fontWeight:'800',textAlign:'center',letterSpacing:-4},unit:{fontSize:10,fontWeight:'700',color:colors.secondary,textAlign:'center',letterSpacing:1},difficultyHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:28,marginBottom:10},difficultyTitle:{fontSize:15,fontWeight:'700'},recommendation:{fontSize:11,color:colors.blue,fontWeight:'600'},options:{flexDirection:'row',gap:8},option:{flex:1,minHeight:72,borderRadius:17,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,backgroundColor:colors.card,paddingHorizontal:10,justifyContent:'center'},optionActive:{borderColor:colors.blue,backgroundColor:colors.blueSoft},optionLabel:{fontSize:13,fontWeight:'700',color:colors.text},optionLabelActive:{color:colors.blue},optionCaption:{fontSize:10,color:colors.secondary,marginTop:4},description:{fontSize:12,lineHeight:17,color:colors.secondary,marginTop:10,minHeight:34},
});
