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
export function ProgressBar({ value, color = colors.blue }: { value: number; color?: string }) {
  return <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]}/></View>;
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <View style={styles.segmented}>{options.map(option => <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segment, option.value === value && styles.segmentActive]}><Text style={[styles.segmentText, option.value === value && styles.segmentTextActive]}>{option.label}</Text></Pressable>)}</View>;
}
export function ListRow({ title, detail, onPress, destructive = false }: { title: string; detail?: string; onPress?: () => void; destructive?: boolean }) {
  const content = <><View style={{ flex: 1 }}><Text style={[styles.rowTitle, destructive && { color: colors.red }]}>{title}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View>{onPress ? <Text style={styles.chevron}>›</Text> : null}</>;
  return onPress ? <Pressable onPress={onPress} style={styles.listRow}>{content}</Pressable> : <View style={styles.listRow}>{content}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 20 },
  button: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonBlue: { backgroundColor: colors.blue }, buttonDark: { backgroundColor: colors.text }, buttonPlain: { backgroundColor: colors.card },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  section: { color: colors.secondary, fontSize: 15, fontWeight: '700', marginTop: 26, marginBottom: 10, marginLeft: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  progress: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E5E5EA' },
  progressFill: { height: 7, borderRadius: 4 },
  segmented: { flexDirection: 'row', backgroundColor: '#E3E3E8', borderRadius: 12, padding: 3, marginBottom: 16 },
  segment: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, color: colors.secondary, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  listRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.secondary, marginTop: 3 },
  chevron: { fontSize: 26, color: colors.tertiary, marginLeft: 12 },
});
