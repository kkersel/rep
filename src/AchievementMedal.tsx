import React, { useState } from 'react';
import { Animated, Easing, ImageSourcePropType, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './ui';

const medalImages: Record<string, ImageSourcePropType> = {
  first: require('../assets/achievements/first-step.png'),
  week: require('../assets/achievements/week-rhythm.png'),
  ten: require('../assets/achievements/ten-sets.png'),
  growth: require('../assets/achievements/growth.png'),
  duel: require('../assets/achievements/first-win.png'),
  'five-wins': require('../assets/achievements/win-streak.png'),
  century: require('../assets/achievements/century.png'),
  thousand: require('../assets/achievements/thousand.png'),
  regular: require('../assets/achievements/regular.png'),
  discipline: require('../assets/achievements/discipline.png'),
  'ten-wins': require('../assets/achievements/ten-wins.png'),
  speed: require('../assets/achievements/speed.png'),
};

export const achievementMedalSource = (id: string) => medalImages[id] ?? medalImages.first;

export function AchievementMedal({
  id,
  unlocked,
  size = 74,
  onTurnEnd,
}: {
  id: string;
  unlocked: boolean;
  size?: number;
  onTurnEnd?: () => void;
}) {
  const [turn] = useState(() => new Animated.Value(0));
  const rotateY = turn.interpolate({ inputRange: [0, .42, .72, 1], outputRange: ['0deg', '-15deg', '8deg', '0deg'] });
  const scale = turn.interpolate({ inputRange: [0, .42, 1], outputRange: [1, 1.065, 1] });
  const spin = () => {
    turn.stopAnimation();
    turn.setValue(0);
    Animated.timing(turn, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      turn.setValue(0);
      if (finished) onTurnEnd?.();
    });
  };
  return <Pressable accessibilityRole="button" accessibilityLabel="Открыть достижение" onPress={spin}>
    <Animated.View style={{ height: size, width: size, transform: [{ perspective: 700 }, { rotateY }, { scale }] }}>
      <Animated.Image source={achievementMedalSource(id)} style={[s.image, { opacity: unlocked ? 1 : .28 }]} />
      {!unlocked ? <View style={s.lock}><Ionicons color="#fff" name="lock-closed" size={11}/></View> : null}
    </Animated.View>
  </Pressable>;
}

const s = StyleSheet.create({
  image: { height: '100%', width: '100%', resizeMode: 'contain', backfaceVisibility: 'visible' },
  lock: { position: 'absolute', right: 1, bottom: 1, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, borderWidth: 2, borderColor: colors.bg },
});
