import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../state/AppContext';
import { colors, Loading } from '../../ui';

export default function TabsLayout() {
  const { loaded, program } = useApp();
  if (!loaded) return <Loading/>;
  if (!program) return <Redirect href="/setup"/>;

  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: colors.secondary, tabBarStyle: { height: 78, paddingTop: 8, paddingBottom: 12, backgroundColor: '#FFFFFFF2', borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={{ title: 'Главная', tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size}/> }}/>
    <Tabs.Screen name="leaders" options={{ title: 'Лидеры', tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size}/> }}/>
    <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size}/> }}/>
  </Tabs>;
}
