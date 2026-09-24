import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const colors = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#08090A', secondary: '#6E6E73', tertiary: '#AEAEB2',
  line: '#D1D1D6', blue: '#0A84FF', blueSoft: '#E8F3FF', green: '#30D158', orange: '#FF9F0A', red: '#FF453A',
};

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  if (!scroll) return <View style={[styles.screen, { paddingTop: insets.top }, style]}>{children}</View>;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }, style]} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled = false, tone = 'blue' }: { title: string; onPress: () => void; disabled?: boolean; tone?: 'blue' | 'dark' | 'plain' }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, tone === 'plain' ? styles.buttonPlain : tone === 'dark' ? styles.buttonDark : styles.buttonBlue, (pressed || disabled) && { opacity: disabled ? .4 : .72 }]}>
    <Text style={[styles.buttonText, tone === 'plain' && { color: colors.blue }]}>{title}</Text>
  </Pressable>;
}

export function Loading() { return <View style={styles.loading}><ActivityIndicator color={colors.blue}/></View>; }
export function SectionLabel({ children }: { children: React.ReactNode }) { return <Text style={styles.section}>{children}</Text>; }

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 20 },
  button: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonBlue: { backgroundColor: colors.blue }, buttonDark: { backgroundColor: colors.text }, buttonPlain: { backgroundColor: colors.card },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  section: { color: colors.secondary, fontSize: 15, fontWeight: '700', marginTop: 26, marginBottom: 10, marginLeft: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
