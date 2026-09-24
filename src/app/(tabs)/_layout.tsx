import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useApp } from '../../state/AppContext';
import { colors, Loading } from '../../ui';

const Icon = ({ value, color }: { value: string; color: ColorValue }) => <Text style={{ color, fontSize: 19, fontWeight: '700' }}>{value}</Text>;
export default function TabsLayout() {
  const { loaded, program } = useApp();
  if (!loaded) return <Loading/>;
  if (!program) return <Redirect href="/setup"/>;

  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: colors.secondary, tabBarStyle: { height: 78, paddingTop: 8, paddingBottom: 12, backgroundColor: '#FFFFFFF2', borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={{ title: 'Главная', tabBarIcon: ({ color }) => <Icon value="⌂" color={color}/> }}/>
    <Tabs.Screen name="leaders" options={{ title: 'Лидеры', tabBarIcon: ({ color }) => <Icon value="▲" color={color}/> }}/>
    <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Icon value="●" color={color}/> }}/>
  </Tabs>;
}
