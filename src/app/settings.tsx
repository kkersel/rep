import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/AppContext';
import { requestNotificationAccess } from '../notificationService';
import type { AppPreferences } from '../data';
import type { ReminderHour } from '../notificationPlan';
import { supabase } from '../supabase';
import { Card, colors, ListRow, Screen, SectionLabel } from '../ui';

const reminderTimes: readonly { value: ReminderHour; label: string }[] = [
  { value: 9, label: '09:00' },
  { value: 14, label: '14:00' },
  { value: 18, label: '18:00' },
];

export default function SettingsScreen() {
  const { profile, history, updateProfile, resetData } = useApp();
  const [notificationBusy, setNotificationBusy] = useState(false);
  const preferences = profile.preferences;

  const updatePreferences = (patch: Partial<AppPreferences>) => updateProfile({ ...profile, preferences: { ...preferences, ...patch } });
  const setNotifications = async (enabled: boolean) => {
    if (!enabled) { await updatePreferences({ notificationsEnabled: false }); return; }
    setNotificationBusy(true);
    try {
      const granted = await requestNotificationAccess();
      if (!granted) {
        Alert.alert('Уведомления выключены', 'Разреши уведомления для Rep в настройках телефона.');
        return;
      }
      await updatePreferences({ notificationsEnabled: true });
    } finally { setNotificationBusy(false); }
  };
  const clear = () => Alert.alert('Сбросить данные?', 'Программа, история и профиль будут удалены с этого устройства.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Сбросить', style: 'destructive', onPress: () => void resetData().then(() => router.replace('/setup')) },
  ]);
  const logout = () => Alert.alert('Выйти из гостевого профиля?', 'Локальная история останется на устройстве.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Выйти', style: 'destructive', onPress: () => void supabase?.auth.signOut().then(() => updateProfile({ ...profile, userId: undefined, friendCode: undefined })) },
  ]);

  return <Screen>
    <SectionLabel>Уведомления</SectionLabel>
    <Card style={s.toggles}>
      <Toggle title="Напоминания" detail="Тренировки и немного мотивации" value={preferences.notificationsEnabled} disabled={notificationBusy} onChange={value => void setNotifications(value)}/>
      <View style={!preferences.notificationsEnabled && s.disabledGroup}>
        <Toggle title="По программе" detail="В выбранное время тренировочного дня" value={preferences.workoutReminders} disabled={!preferences.notificationsEnabled} onChange={value => void updatePreferences({ workoutReminders: value })}/>
        <Toggle title="Повтор вечером" detail="В 20:30, если тренировка ещё не выполнена" value={preferences.eveningReminder} disabled={!preferences.notificationsEnabled || !preferences.workoutReminders} onChange={value => void updatePreferences({ eveningReminder: value })}/>
        <Toggle title="Мотивация" detail="Случайное короткое напоминание" value={preferences.motivationNotifications} disabled={!preferences.notificationsEnabled} onChange={value => void updatePreferences({ motivationNotifications: value })}/>
      </View>
    </Card>
    {preferences.notificationsEnabled ? <>
      <Text style={s.optionTitle}>Когда напоминать</Text>
      <OptionRow>{reminderTimes.map(option => <Choice key={option.value} label={option.label} selected={preferences.reminderHour === option.value} onPress={() => void updatePreferences({ reminderHour: option.value })}/>)}</OptionRow>
      {preferences.motivationNotifications ? <><Text style={s.optionTitle}>Случайные напоминания</Text><OptionRow><Choice label="1 в неделю" selected={preferences.motivationPerWeek === 1} onPress={() => void updatePreferences({ motivationPerWeek: 1 })}/><Choice label="2 в неделю" selected={preferences.motivationPerWeek === 2} onPress={() => void updatePreferences({ motivationPerWeek: 2 })}/></OptionRow></> : null}
    </> : null}

    <SectionLabel>Тренировки</SectionLabel>
    <Card style={s.toggles}><Toggle title="Голосовые подсказки" value={preferences.voice} onChange={value => void updatePreferences({ voice: value })}/><Toggle title="Вибрация" value={preferences.haptics} onChange={value => void updatePreferences({ haptics: value })}/><Toggle title="Звуки старта и финиша" value={preferences.sounds} onChange={value => void updatePreferences({ sounds: value })}/></Card>
    <SectionLabel>Приватность</SectionLabel>
    <Card style={s.toggles}><Toggle title="Скрытый профиль" value={preferences.privateProfile} onChange={value => void updatePreferences({ privateProfile: value })}/><ListRow title="Экспортировать статистику" onPress={() => void Share.share({ message: JSON.stringify({ profile: { nickname: profile.nickname }, history }, null, 2) })}/></Card>
    <SectionLabel>Информация</SectionLabel>
    <Card style={s.toggles}><ListRow title="Как работает рейтинг PWR" onPress={() => router.push('/rating-info')}/></Card>
    <SectionLabel>Данные</SectionLabel>
    <Card style={s.toggles}>{profile.userId ? <ListRow title="Выйти из гостевого профиля" onPress={logout}/> : null}<ListRow title="Сбросить локальные данные" destructive onPress={clear}/></Card>
  </Screen>;
}

function Toggle({ title, detail, value, disabled = false, onChange }: { title: string; detail?: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <View style={s.toggle}><View style={s.toggleCopy}><Text style={s.toggleText}>{title}</Text>{detail ? <Text style={s.toggleDetail}>{detail}</Text> : null}</View><Switch disabled={disabled} value={value} onValueChange={onChange} trackColor={{ true: colors.green }}/></View>;
}
function OptionRow({ children }: { children: React.ReactNode }) { return <View style={s.options}>{children}</View>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.choice, selected && s.choiceSelected, pressed && s.pressed]}><Text style={[s.choiceText, selected && s.choiceTextSelected]}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  label:{fontSize:12,color:colors.secondary,fontWeight:'600'},input:{height:50,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line,fontSize:18,marginBottom:16},toggles:{paddingVertical:0},toggle:{minHeight:66,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.line},toggleCopy:{flex:1,paddingRight:12},toggleText:{fontSize:16,fontWeight:'600'},toggleDetail:{fontSize:11,lineHeight:15,color:colors.secondary,marginTop:3},disabledGroup:{opacity:.42},optionTitle:{fontSize:12,fontWeight:'600',color:colors.secondary,marginTop:13,marginBottom:7,marginLeft:4},options:{flexDirection:'row',gap:8},choice:{flex:1,minHeight:43,borderRadius:14,backgroundColor:colors.card,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,alignItems:'center',justifyContent:'center'},choiceSelected:{backgroundColor:colors.blueSoft,borderColor:colors.blue},choiceText:{fontSize:13,fontWeight:'600',color:colors.secondary},choiceTextSelected:{color:colors.blue},pressed:{opacity:.62,transform:[{scale:.98}]},
});
