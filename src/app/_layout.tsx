import 'react-native-gesture-handler';
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../state/AppContext';
import { colors } from '../ui';

export default function RootLayout() {
  return <SafeAreaProvider><AppProvider><StatusBar style="dark"/><Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.blue, headerTitleStyle: { color: colors.text }, contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Screen name="index" options={{ headerShown: false }}/>
    <Stack.Screen name="setup" options={{ headerShown: false, gestureEnabled: false }}/>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
    <Stack.Screen name="program" options={{ title: 'Программа', presentation: 'card' }}/>
    <Stack.Screen name="session" options={{ headerShown: false, gestureEnabled: false }}/>
    <Stack.Screen name="history" options={{ title: 'История' }}/>
    <Stack.Screen name="statistics" options={{ title: 'Статистика' }}/>
    <Stack.Screen name="achievements" options={{ title: 'Достижения' }}/>
    <Stack.Screen name="settings" options={{ title: 'Настройки' }}/>
    <Stack.Screen name="pvp/index" options={{ title: 'PvP' }}/>
    <Stack.Screen name="pvp/match" options={{ headerShown: false, gestureEnabled: false }}/>
  </Stack></AppProvider></SafeAreaProvider>;
}
