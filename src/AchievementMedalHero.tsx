import React, { useMemo, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { achievementMedalSource } from './AchievementMedal';

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

type Props = {
  id: string;
  unlocked: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
};

export function AchievementMedalHero({ id, unlocked, onSwipeLeft, onSwipeRight, onSwipeDown }: Props) {
  const [tilt] = useState(() => new Animated.ValueXY());
  const [scale] = useState(() => new Animated.Value(1));
  const pan = useMemo(() => {
    const reset = () => Animated.parallel([
      Animated.spring(tilt, { toValue: { x: 0, y: 0 }, speed: 18, bounciness: 7, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 4, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      tilt.stopAnimation();
      scale.stopAnimation();
      Animated.spring(scale, { toValue: 1.025, speed: 28, bounciness: 2, useNativeDriver: Platform.OS !== 'web' }).start();
    },
    onPanResponderMove: (_, gesture) => {
      tilt.setValue({ x: clamp(gesture.dx / 115), y: clamp(gesture.dy / 115) });
    },
    onPanResponderRelease: (_, gesture) => {
      const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15;
      const vertical = Math.abs(gesture.dy) > Math.abs(gesture.dx) * .9;
      if (vertical && gesture.dy > 76 && (gesture.vy > .25 || gesture.dy > 120)) onSwipeDown?.();
      else if (horizontal && gesture.dx < -62 && (gesture.vx < -.2 || gesture.dx < -105)) onSwipeLeft?.();
      else if (horizontal && gesture.dx > 62 && (gesture.vx > .2 || gesture.dx > 105)) onSwipeRight?.();
      reset();
    },
    onPanResponderTerminate: reset,
  });
  }, [onSwipeDown, onSwipeLeft, onSwipeRight, scale, tilt]);

  const rotateX = tilt.y.interpolate({ inputRange: [-1, 0, 1], outputRange: ['7deg', '0deg', '-7deg'] });
  const rotateY = tilt.x.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '8deg'] });

  return <View style={s.stage} {...pan.panHandlers}>
    <View pointerEvents="none" style={s.glow}/>
    <Animated.Image
      accessibilityLabel={unlocked ? 'Полученная медаль достижения' : 'Медаль достижения'}
      source={achievementMedalSource(id)}
      style={[s.medal, { transform: [{ perspective: 900 }, { rotateX }, { rotateY }, { scale }] }]}
    />
  </View>;
}

const s = StyleSheet.create({
  stage: { width: 340, height: 340, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(126,182,255,.12)' },
  medal: {
    width: 326,
    height: 326,
    resizeMode: 'contain',
    backfaceVisibility: 'visible',
    shadowColor: '#72ACF7',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: .22,
    shadowRadius: 28,
  },
});
